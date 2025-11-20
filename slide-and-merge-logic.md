## Requirements

**Input:** Row of 4 MaybeTiles
**Output:** Row of 4 MaybeTiles after slide left + merge

**Rules:**
1. All tiles slide left, removing gaps
2. Adjacent tiles with same value merge into one tile with doubled value
3. Only one merge per tile per move (no chain merging: [2,2,2,2] → [4,4] not [8])
4. Track state for each tile:
   - `static`: didn't move
   - `moved`: slid to new position, store original position in `from`
   - `merged`: two tiles merged, store both original positions in `from1`/`from2` and original value in `value`

## Test Cases

**Test 1:** `[2, null, null, 2]`
- Result: `[4(merged, from1=pos@0, from2=pos@3, value=2), null, null, null]`

**Test 2:** `[2, 2, 2, 2]`
- Result: `[4(merged, from1=pos@0, from2=pos@1, value=2), 4(merged, from1=pos@2, from2=pos@3, value=2), null, null]`

**Test 3:** `[null, 4, null, 8]`
- Result: `[4(moved, from=pos@1), 8(moved, from=pos@3), null, null]`

**Test 4:** `[2, null, null, null]`
- Result: `[2(static), null, null, null]`

**Test 5:** `[4, 4, 8, 8]`
- Result: `[8(merged, from1=pos@0, from2=pos@1, value=4), 16(merged, from1=pos@2, from2=pos@3, value=8), null, null]`

**Test 6:** `[2, 4, 2, 4]`
- Result: `[2(static), 4(static), 2(static), 4(static)]`

**Test 7:** `[null, null, null, null]`
- Result: `[null, null, null, null]`

**Test 8:** `[null, null, 2, null]`
- Result: `[2(moved, from=pos@2), null, null, null]`

**Test 9:** `[null, null, null, 2]`
- Result: `[2(moved, from=pos@3), null, null, null]`

**Test 10:** `[2, null, 2, null]`
- Result: `[4(merged, from1=pos@0, from2=pos@2, value=2), null, null, null]`

**Test 11:** `[2, 2, 2, null]`
- Result: `[4(merged, from1=pos@0, from2=pos@1, value=2), 2(moved, from=pos@2), null, null]`

**Test 12:** `[2, 2, null, 4]`
- Result: `[4(merged, from1=pos@0, from2=pos@1, value=2), 4(moved, from=pos@3), null, null]`

**Test 13:** `[2, null, 4, null]`
- Result: `[2(moved, from=pos@0), 4(moved, from=pos@2), null, null]`

**Test 14:** `[2, 4, 8, 16]`
- Result: `[2(static), 4(static), 8(static), 16(static)]`

**Test 15:** `[2, 4, null, null]`
- Result: `[2(static), 4(static), null, null]`

**Test 16:** `[2, 4, 8, null]`
- Result: `[2(static), 4(static), 8(static), null]`
