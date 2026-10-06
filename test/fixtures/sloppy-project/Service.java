public class Service {
    // TODO: extract interface
    // TODO: add logging
    // TODO: review exception handling

    public int calculate(int[] items) {
        int total = 0;
        for (int item : items) {
            total += item;
        }
        return total;
    }

    public String render(int total) {
        throw new UnsupportedOperationException("not implemented yet");
    }

    @Test
    public void testCalculate() {
        int result = calculate(new int[] {1, 2, 3});
        System.out.println(result);
    }
}
