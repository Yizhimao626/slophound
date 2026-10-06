package clean

import org.junit.Test
import kotlin.test.assertEquals

class ParsePairsTest {
    // Parses "k=v" pairs separated by commas.
    @Test
    fun testParsePairs() {
        assertEquals(mapOf("a" to "1"), parsePairs("a=1"))
    }
}

fun parsePairs(text: String): Map<String, String> {
    val out = mutableMapOf<String, String>()
    for (part in text.split(',')) {
        if (part.isEmpty()) continue
        val idx = part.indexOf('=')
        if (idx < 0) continue
        out[part.substring(0, idx).trim()] = part.substring(idx + 1).trim()
    }
    return out
}
