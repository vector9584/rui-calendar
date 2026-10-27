#!/usr/bin/env python3
"""Baikal CalDAV 写入 helper（瑞历）。零外部依赖（urllib stdlib）。

供监控/自动化脚本 import，把日程/待办写到 Baikal「个人」日历，让 iOS / Calino（瑞历）
等多端实时一致。可用于任何想用 AI 助手（如 Hermes Agent）直接操作日历的场景。

数据源（全部通过环境变量注入，不落明文）：
  - 端点  BAIKAL_BASE_URL（形如 https://your-dav.example.com/dav.php）
  - 用户  BAIKAL_USER_NAME（默认 vector），密码 BAIKAL_USER_PASS
  - 凭据文件 BAIKAL_ENV_FILE（默认 ~/.baikal.env，一行 KEY=VALUE）
  - 日历  /calendars/{user}/personal/  （uri=personal）

设计要点：
  - 幂等：UID 即文件名，同名 PUT = 覆盖更新（天然幂等，无需 etag 并发保护）。
  - 时间：脚本传入 naive 北京时间 datetime/date，helper 内部转 UTC 写 `...Z`，
    避开 TZID/VTIMEZONE 的时区坑（某日历服务 timed→全天 bug 的教训）。
  - 全天：start/end 传 date，写 DTSTART;VALUE=DATE / DTEND 次日。
  - 提醒：alarm_minutes 生成 VALARM（TRIGGER:-PT{N}M，相对 DTSTART）。
  - 循环：rrule 传 RFC5545 字符串（FREQ=DAILY / FREQ=WEEKLY;BYDAY=... 等）。

用法：
  from baikal_calendar import BaikalCal
  cal = BaikalCal()
  cal.put_event(uid="my-event-123@example", summary="标题",
                start=datetime(...), end=datetime(...), alarm_minutes=30)
  cal.list_uids()                 # -> set[str]
  cal.get_event(uid)              # -> dict 或 None
  cal.delete_event(uid)           # -> bool
"""

import os
import re
import ssl
import base64
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

_ENV_FILE_DEFAULT = os.path.expanduser("~/.baikal.env")
_BASE_DEFAULT = "https://your-dav.example.com/dav.php"
_BJ = ZoneInfo("Asia/Shanghai")
_UTC = timezone.utc

_REPORT = ('<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
           '<d:prop><d:getetag/><c:calendar-data/></d:prop>'
           '<c:filter><c:comp-filter name="VCALENDAR">'
           '<c:comp-filter name="VEVENT"/></c:comp-filter></c:filter>'
           '</c:calendar-query>')


def _load_env(path):
    env = {}
    if path and os.path.exists(path):
        for line in open(path, encoding="utf-8", errors="ignore"):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def _ics_escape(s):
    """iCalendar 文本转义：\\ ; , 换行。"""
    if s is None:
        return ""
    s = str(s).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
    return s.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")


def _fold(s):
    """RFC5545 行长折行（每行 ≤75 字节，续行以空格开头）。DESCRIPTION 长文本必须折行。"""
    out = []
    for line in s.split("\n"):
        b = line.encode("utf-8")
        while len(b) > 75:
            cut = 75
            # 不截断多字节 UTF-8 字符
            while cut > 0 and (b[cut] & 0xC0) == 0x80:
                cut -= 1
            out.append(b[:cut].decode("utf-8", errors="ignore"))
            b = b" " + b[cut:]
        out.append(b.decode("utf-8", errors="ignore"))
    return "\n".join(out)


class BaikalCal:
    def __init__(self, env_file=None, base=None):
        env_file = env_file or os.environ.get("BAIKAL_ENV_FILE", _ENV_FILE_DEFAULT)
        base = base or os.environ.get("BAIKAL_BASE_URL", _BASE_DEFAULT)
        env = _load_env(env_file)
        self.user = env.get("BAIKAL_USER_NAME", "vector")
        self.passwd = env.get("BAIKAL_USER_PASS", "")
        self.base = base.rstrip("/")
        self.cal = f"{self.base}/calendars/{self.user}/personal/"
        self.ctx = ssl.create_default_context()
        self.ctx.check_hostname = False
        self.ctx.verify_mode = ssl.CERT_NONE
        self._auth = "Basic " + base64.b64encode(
            f"{self.user}:{self.passwd}".encode()).decode()

    # ---------- 底层 HTTP ----------
    def _req(self, method, url, data=None, headers=None):
        h = {"Authorization": self._auth}
        if headers:
            h.update(headers)
        body = data.encode("utf-8") if isinstance(data, str) else data
        r = urllib.request.Request(url, data=body, method=method, headers=h)
        try:
            with urllib.request.urlopen(r, timeout=30, context=self.ctx) as resp:
                return resp.status, resp.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", errors="ignore")
        except Exception as e:
            raise RuntimeError(f"CalDAV {method} {url} 失败: {e}")

    # ---------- 时间工具 ----------
    @staticmethod
    def to_utc(dt):
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=_BJ)
            return dt.astimezone(_UTC)
        return dt

    # ---------- 生成 VEVENT ----------
    def _build_ics(self, uid, summary, start, end, description="", location="",
                   all_day=False, alarm_minutes=None, rrule=None):
        now = datetime.now(_UTC).strftime("%Y%m%dT%H%M%S")
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Hermes//Baikal//CN",
            "CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now}Z",
        ]
        if all_day:
            d0 = start.strftime("%Y%m%d")
            d1 = end.strftime("%Y%m%d")
            lines.append(f"DTSTART;VALUE=DATE:{d0}")
            lines.append(f"DTEND;VALUE=DATE:{d1}")
        else:
            s = self.to_utc(start).strftime("%Y%m%dT%H%M%S")
            e = self.to_utc(end).strftime("%Y%m%dT%H%M%S")
            lines.append(f"DTSTART:{s}Z")
            lines.append(f"DTEND:{e}Z")
        lines.append(f"SUMMARY:{_ics_escape(summary)}")
        if location:
            lines.append(f"LOCATION:{_ics_escape(location)}")
        if description:
            lines.append(f"DESCRIPTION:{_ics_escape(description)}")
        if rrule:
            lines.append(f"RRULE:{rrule}")
        if alarm_minutes is not None:
            lines += [
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                f"DESCRIPTION:{_ics_escape(summary)}",
                f"TRIGGER:-PT{int(alarm_minutes)}M",
                "END:VALARM",
            ]
        lines += ["END:VEVENT", "END:VCALENDAR"]
        return _fold("\n".join(lines)) + "\n"

    # ---------- 增删改查 ----------
    def put_event(self, uid, summary, start, end, description="", location="",
                  all_day=False, alarm_minutes=None, rrule=None):
        """写/覆盖一条日程（幂等）。返回 (status, uid)。"""
        ics = self._build_ics(uid, summary, start, end, description, location,
                              all_day, alarm_minutes, rrule)
        st, _ = self._req("PUT", self.cal + uid + ".ics",
                          data=ics, headers={"Content-Type": "text/calendar; charset=utf-8"})
        return st, uid

    def get_event(self, uid):
        """单条读取，返回 ics 文本；不存在返回 None（404）。"""
        st, body = self._req("GET", self.cal + uid + ".ics")
        return body if st == 200 else None

    def delete_event(self, uid):
        st, _ = self._req("DELETE", self.cal + uid + ".ics")
        return st in (200, 204, 404)

    def list_uids(self):
        """返回日历里所有 VEVENT 的 UID 集合。"""
        st, body = self._req("REPORT", self.cal,
                             headers={"Depth": "1", "Content-Type": "application/xml"},
                             data=_REPORT)
        if st != 207:
            raise RuntimeError(f"REPORT 失败 status={st}")
        return set(re.findall(r"^UID:(.+)$", body, re.M))

    def list_events(self):
        """返回所有 VEVENT 的结构化摘要 [{uri, uid, summary, dtstart, dtend, rrule}]。

        · uri  = CalDAV 对象文件名（href 最后一段，不含 .ics），删除时必须用它。
        · uid  = VEVENT 内部 UID（同步唯一键）。⚠️ 迁移导入的 RRULE 事件 uri ≠ uid，
          删旧对象要用 uri 而不是 uid；新写入的事件 uri == uid（put_event 保证）。
        """
        st, body = self._req("REPORT", self.cal,
                             headers={"Depth": "1", "Content-Type": "application/xml"},
                             data=_REPORT)
        out = []
        if st != 207:
            return out
        for resp in re.findall(r"<d:response>.*?</d:response>", body, re.DOTALL):
            hm = re.search(r"<d:href>(.*?)</d:href>", resp, re.DOTALL)
            if not hm:
                continue
            uri = hm.group(1).strip().rstrip("/").split("/")[-1]
            if uri.endswith(".ics"):
                uri = uri[:-4]
            cm = re.search(r"<cal:calendar-data>(.*?)</cal:calendar-data>", resp, re.DOTALL)
            if not cm:
                continue
            blk = cm.group(1)

            def g(key):
                m = re.search(rf"^{key}[:;][^\r\n]*", blk, re.M)
                return m.group(0).split(":", 1)[1] if m else None
            out.append({
                "uri": uri,
                "uid": g("UID"),
                "summary": g("SUMMARY"),
                "dtstart": g("DTSTART"),
                "dtend": g("DTEND"),
                "rrule": g("RRULE"),
            })
        return out

    def delete_uri(self, uri):
        """按 CalDAV 对象文件名删除（uri 不含 .ics）。返回是否成功。"""
        st, _ = self._req("DELETE", self.cal + uri + ".ics")
        return st in (200, 204, 404)


if __name__ == "__main__":
    # selftest：建一条 24h 后过期的测试事件，增→查→删，自证
    import uuid as _uuid
    cal = BaikalCal()
    uid = f"hermes-selftest-{_uuid.uuid4().hex[:8]}@hermes"
    now = datetime.now()
    st, _ = cal.put_event(
        uid=uid, summary="[hermes selftest] 请忽略",
        start=now + timedelta(days=1), end=now + timedelta(days=1, hours=1),
        description="selftest", alarm_minutes=30)
    print("PUT status:", st)
    print("GET exists:", cal.get_event(uid) is not None)
    print("UID in list:", uid in cal.list_uids())
    print("DELETE:", cal.delete_event(uid))
    print("GET after delete:", cal.get_event(uid) is not None)
