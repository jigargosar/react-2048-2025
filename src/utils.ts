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