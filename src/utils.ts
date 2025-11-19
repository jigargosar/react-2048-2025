export type Matrix<T> = ReadonlyArray<ReadonlyArray<T>>

export function transpose<T>(array: Matrix<T>): Matrix<T | null> {
    const firstRow = array[0] ?? []
    return firstRow.map((_, colIndex) => array.map((row) => row[colIndex] ?? null))
}

export function reverseRows<T>(array: Matrix<T>): Matrix<T> {
    return array.map((row) => row.toReversed())
}