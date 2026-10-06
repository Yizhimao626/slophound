import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class Util {
    // Returns n! for small n.
    static long factorial(int n) {
        long result = 1;
        for (int i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }

    @Test
    public void testFactorial() {
        assertEquals(120, factorial(5));
    }
}
