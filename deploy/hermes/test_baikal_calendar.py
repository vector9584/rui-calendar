#!/usr/bin/env python3
"""baikal_calendar.py 的核心逻辑回归测试（零依赖，stdlib unittest）。

覆盖：时区转换、ICS 文本转义、RFC5545 折行、事件生成（定时/全天/提醒/循环）、
put_event 幂等（mock 网络层）。不发起任何真实网络请求。

运行：
    python -m unittest deploy.hermes.test_baikal_calendar
    或 cd deploy/hermes && python -m unittest test_baikal_calendar
"""

import unittest
from datetime import datetime, date
from unittest.mock import patch

from baikal_calendar import BaikalCal, _ics_escape, _fold


class TestTimeZone(unittest.TestCase):
    def setUp(self):
        self.cal = BaikalCal()

    def test_beijing_afternoon_to_utc(self):
        # 北京时间 14:00 = UTC 06:00
        u = self.cal.to_utc(datetime(2026, 10, 28, 14, 0))
        self.assertEqual(u.strftime("%Y%m%dT%H%M%S"), "20261028T060000")

    def test_beijing_midnight_crosses_day(self):
        # 北京时间 00:00 = UTC 前一日 16:00
        u = self.cal.to_utc(datetime(2026, 10, 28, 0, 0))
        self.assertEqual(u.strftime("%Y%m%dT%H%M%S"), "20261027T160000")


class TestEscape(unittest.TestCase):
    def test_comma(self):
        self.assertEqual(_ics_escape("a,b"), "a\\,b")

    def test_semicolon(self):
        self.assertEqual(_ics_escape("a;b"), "a\\;b")

    def test_backslash(self):
        self.assertEqual(_ics_escape("a\\b"), "a\\\\b")

    def test_newline(self):
        self.assertEqual(_ics_escape("a\nb"), "a\\nb")

    def test_none(self):
        self.assertEqual(_ics_escape(None), "")


class TestFold(unittest.TestCase):
    def test_long_text_folded_under_75_bytes(self):
        # 60 个中文字符 = 180 字节，必须折成多行，每行 ≤75 字节
        folded = _fold("DESCRIPTION:" + "测" * 60)
        lines = folded.split("\n")
        self.assertGreater(len(lines), 1)
        self.assertTrue(all(len(l.encode("utf-8")) <= 75 for l in lines))


class TestBuildIcs(unittest.TestCase):
    def setUp(self):
        self.cal = BaikalCal()

    def test_timed_event(self):
        ics = self.cal._build_ics(
            "test@x", "标题",
            datetime(2026, 10, 28, 14, 0), datetime(2026, 10, 28, 15, 0),
            description="描述", location="地点",
            alarm_minutes=30, rrule="FREQ=DAILY")
        self.assertIn("UID:test@x", ics)
        self.assertIn("SUMMARY:标题", ics)
        self.assertIn("DTSTART:20261028T060000Z", ics)  # 北京时间转 UTC
        self.assertIn("DTEND:20261028T070000Z", ics)
        self.assertIn("LOCATION:地点", ics)
        self.assertIn("RRULE:FREQ=DAILY", ics)
        self.assertIn("TRIGGER:-PT30M", ics)
        self.assertTrue(ics.startswith("BEGIN:VCALENDAR"))
        self.assertTrue(ics.rstrip().endswith("END:VCALENDAR"))

    def test_allday_event(self):
        ics = self.cal._build_ics(
            "allday@x", "全天", date(2026, 10, 28), date(2026, 10, 29), all_day=True)
        self.assertIn("DTSTART;VALUE=DATE:20261028", ics)
        self.assertIn("DTEND;VALUE=DATE:20261029", ics)
        self.assertNotIn("T060000Z", ics)  # 全天不带时间/时区


class TestPutEvent(unittest.TestCase):
    def test_put_idempotent(self):
        cal = BaikalCal()
        with patch.object(cal, "_req", return_value=(201, "")) as mock_req:
            st, uid = cal.put_event(
                "idem@x", "t", datetime(2026, 10, 28, 14, 0), datetime(2026, 10, 28, 15, 0))
        self.assertEqual(st, 201)
        self.assertEqual(uid, "idem@x")
        args = mock_req.call_args[0]
        self.assertEqual(args[0], "PUT")
        self.assertTrue(args[1].endswith("idem@x.ics"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
