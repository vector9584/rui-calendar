/**
 * /tasks drag-to-parent.
 *
 * User flow on /tasks:
 *   - Dragging a task onto another task makes the dragged task a child of
 *     the target (parentTaskId = target.id). The new depth is reflected by
 *     the data-task-depth attribute the test exercises on render.
 *   - Dragging a task and releasing it anywhere that isn't directly over
 *     another task row clears parentTaskId, so a subtask becomes a
 *     root-level task again. There's no dedicated drop zone to aim for.
 *   - Drops onto self or any descendant are rejected — they would create
 *     a cycle in the parent/child graph.
 *
 * This spec mirrors the dnd-kit activation pattern used in drag-anim.spec.ts
 * (PointerSensor with an 8px distance threshold), so the same drag helper
 * works regardless of which dnd-kit enabled view we're driving.
 */
import { test, expect, type Page } from '@playwright/test'
import { clearState } from './fixtures/localstorage'

interface TaskSeed {
  id: string
  title: string
  parentTaskId?: string
}

async function seedTasks(page: Page, tasks: TaskSeed[]): Promise<void> {
  await page.addInitScript(
    ({ calendarKey, tasks }: { calendarKey: string; tasks: TaskSeed[] }) => {
      try {
        if (sessionStorage.getItem('__calino_test_todo_drag_parent')) return
        sessionStorage.setItem('__calino_test_todo_drag_parent', '1')
        const raw = localStorage.getItem(calendarKey)
        const parsed = raw ? JSON.parse(raw) : { state: {}, version: 1 }
        const events = tasks.map((task) => ({
          id: task.id,
          calendarId: 'default',
          title: task.title,
          type: 'task',
          parentTaskId: task.parentTaskId,
          start: '2026-07-10T09:00:00.000Z',
          end: '2026-07-10T09:00:00.000Z',
          isAllDay: false,
          completed: false,
        }))
        const existing = parsed.state?.events ?? []
        existing.push(...events)
        parsed.state = {
          ...(parsed.state ?? {}),
          events: existing,
          calendars: [
            {
              id: 'default',
              name: 'Personal',
              color: '#4285F4',
              isVisible: true,
              isDefault: true,
              showTasksInViews: true,
            },
          ],
        }
        localStorage.setItem(calendarKey, JSON.stringify(parsed))
      } catch {
        /* noop */
      }
    },
    { calendarKey: 'calino-storage', tasks }
  )
}

// Drag from (src.x, src.y) to a point picked by `pickDst` after the drag has
// been initiated. The 8px activation nudge dnd-kit's PointerSensor needs is
// applied before `pickDst` is called, so any DOM that mounts as a side effect
// of the drag (e.g. the root drop zone) is present and laid out by then.
async function performDrag(
  page: Page,
  src: { x: number; y: number },
  pickDst: (page: Page) => Promise<{ x: number; y: number }>
): Promise<void> {
  await page.mouse.move(src.x, src.y)
  await page.waitForTimeout(20)
  await page.mouse.down()
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(src.x + i * 3, src.y, { steps: 1 })
    await page.waitForTimeout(15)
  }
  const dst = await pickDst(page)
  await page.mouse.move(dst.x, dst.y, { steps: 20 })
  await page.waitForTimeout(50)
  await page.mouse.up()
}

// Wait for the virtualized list to settle so the target row is mounted and
// laid out before we read its bounding box.
async function waitForTask(page: Page, taskId: string): Promise<void> {
  await expect(page.locator(`[data-task-id="${taskId}"]`)).toBeVisible()
}

async function rowCenter(page: Page, taskId: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(`[data-task-id="${taskId}"]`).boundingBox()
  if (!box) throw new Error(`no bounding box for ${taskId}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('/tasks — drag a task onto another to nest it', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page)
  })

  test('drag "Buy milk" onto "Groceries" makes it a child (depth 1)', async ({
    page,
  }) => {
    await seedTasks(page, [
      { id: 'groceries', title: 'Groceries' },
      { id: 'milk', title: 'Buy milk' },
    ])
    await page.goto('/tasks')
    await waitForTask(page, 'groceries')
    await waitForTask(page, 'milk')

    // Sanity: both start as roots (depth 0).
    await expect(page.locator('[data-task-id="groceries"]')).toHaveAttribute(
      'data-task-depth',
      '0'
    )
    await expect(page.locator('[data-task-id="milk"]')).toHaveAttribute(
      'data-task-depth',
      '0'
    )

    const src = await rowCenter(page, 'milk')
    await performDrag(page, src, async () => rowCenter(page, 'groceries'))

    // After drag: milk's depth becomes 1 (child of groceries).
    await expect(page.locator('[data-task-id="milk"]')).toHaveAttribute(
      'data-task-depth',
      '1'
    )
  })

  test('drag a subtask onto blank space promotes it back to root', async ({
    page,
  }) => {
    await seedTasks(page, [
      { id: 'plan-trip', title: 'Plan trip' },
      { id: 'pack', title: 'Pack bags', parentTaskId: 'plan-trip' },
    ])
    await page.goto('/tasks')
    await waitForTask(page, 'plan-trip')
    await waitForTask(page, 'pack')

    // Sanity: pack starts as depth 1.
    await expect(page.locator('[data-task-id="pack"]')).toHaveAttribute(
      'data-task-depth',
      '1'
    )

    // There's no dedicated root drop zone — releasing over any point that
    // isn't another task row (here, the empty space below the last row)
    // is enough to promote the dragged task back to root.
    const src = await rowCenter(page, 'pack')
    await performDrag(page, src, async (p) => {
      const list = p.locator('[data-component="todo-task-list"]')
      const box = await list.boundingBox()
      if (!box) throw new Error('no task-list box')
      return { x: box.x + box.width / 2, y: box.y + box.height - 5 }
    })

    // After drag: pack is depth 0 again.
    await expect(page.locator('[data-task-id="pack"]')).toHaveAttribute(
      'data-task-depth',
      '0'
    )
  })

  test('root-drop hint appears over blank space and clears over a task row', async ({
    page,
  }) => {
    await seedTasks(page, [
      { id: 'plan-trip', title: 'Plan trip' },
      { id: 'pack', title: 'Pack bags', parentTaskId: 'plan-trip' },
    ])
    await page.goto('/tasks')
    await waitForTask(page, 'plan-trip')
    await waitForTask(page, 'pack')

    const list = page.locator('[data-component="todo-task-list"]')
    const src = await rowCenter(page, 'pack')
    const overTarget = await rowCenter(page, 'plan-trip')
    const listBox = await list.boundingBox()
    if (!listBox) throw new Error('no task-list box')
    const blankSpace = { x: listBox.x + listBox.width / 2, y: listBox.y + listBox.height - 5 }

    // No hint before a drag starts.
    await expect(list).not.toHaveAttribute('data-root-drop-hint', '')

    await page.mouse.move(src.x, src.y)
    await page.waitForTimeout(20)
    await page.mouse.down()
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(src.x + i * 3, src.y, { steps: 1 })
      await page.waitForTimeout(15)
    }

    // Hovering another task row — no root-drop hint (it would nest instead).
    await page.mouse.move(overTarget.x, overTarget.y, { steps: 10 })
    await page.waitForTimeout(50)
    await expect(list).not.toHaveAttribute('data-root-drop-hint', '')

    // Hovering blank space with no row underneath — hint appears since
    // "pack" has a parent and a drop here would promote it to root.
    await page.mouse.move(blankSpace.x, blankSpace.y, { steps: 10 })
    await page.waitForTimeout(50)
    await expect(list).toHaveAttribute('data-root-drop-hint', '')

    await page.mouse.up()

    // Hint clears once the drag ends.
    await expect(list).not.toHaveAttribute('data-root-drop-hint', '')
  })

  test('drag a task onto its own descendant is a no-op (cycle guard)', async ({
    page,
  }) => {
    await seedTasks(page, [
      { id: 'parent', title: 'Parent' },
      { id: 'child', title: 'Child', parentTaskId: 'parent' },
      { id: 'grand', title: 'Grandchild', parentTaskId: 'child' },
    ])
    await page.goto('/tasks')
    await waitForTask(page, 'parent')
    await waitForTask(page, 'child')
    await waitForTask(page, 'grand')

    // Try to drop the parent onto its own grandchild. This would create
    // parent→grand→...→parent loop; the handler must refuse.
    const src = await rowCenter(page, 'parent')
    await performDrag(page, src, async () => rowCenter(page, 'grand'))

    // Wait a beat — if the mutation happened, the depths would shift.
    await page.waitForTimeout(300)

    await expect(page.locator('[data-task-id="child"]')).toHaveAttribute(
      'data-task-depth',
      '1'
    )
    await expect(page.locator('[data-task-id="grand"]')).toHaveAttribute(
      'data-task-depth',
      '2'
    )
  })

  test('drag a task onto itself is a no-op', async ({ page }) => {
    await seedTasks(page, [{ id: 'only', title: 'Only task' }])
    await page.goto('/tasks')
    await waitForTask(page, 'only')

    const src = await rowCenter(page, 'only')
    await performDrag(page, src, async () => ({ x: src.x + 200, y: src.y }))

    // The row is still depth 0.
    await expect(page.locator('[data-task-id="only"]')).toHaveAttribute(
      'data-task-depth',
      '0'
    )
  })
})
