package reporting

// Placeholder totals service used by the batch jobs.

class Totals {
    fun sum(values: List<Int>): Int {
        TODO("not implemented")
    }

    @Test
    fun testSum() {
        val totals = Totals()
        val result = totals.sum(listOf(1, 2, 3))
        println(result)
    }
}
