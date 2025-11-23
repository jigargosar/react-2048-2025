export type Matrix<T> = ReadonlyArray<ReadonlyArray<T>>

export function transpose<T>(array: Matrix<T>): Matrix<T | null> {
    const firstRow = array[0] ?? []
    return firstRow.map((_, colIndex) => array.map((row) => row[colIndex] ?? null))
}

export function reverseRows<T>(array: Matrix<T>): Matrix<T> {
    return array.map((row) => row.toReversed())
}

export function keep<T>(
    predicate: (item: T) => boolean,
    arr: readonly T[],
): T[] {
    return arr.filter(predicate)
}

export function reject<T>(
    predicate: (item: T) => boolean,
    arr: readonly T[],
): T[] {
    return arr.filter((x) => {
        return !predicate(x)
    })
}


export function keepNonNil<T>(arr: readonly (T | null | undefined)[]): T[] {
    const result: T[] = []
    for (const item of arr) {
        if (item !== null && item !== undefined) {
            result.push(item)
        }
    }
    return result
}

export function createSeededRandom(seed: number): () => number {
    let s = seed
    return () => {
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}