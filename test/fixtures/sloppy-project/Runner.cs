using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Reporting
{
    // TODO: split math and formatting
    // TODO: add XML docs
    // TODO: unify rounding

    [TestClass]
    public class Runner
    {
        public int Sum(int[] values)
        {
            var total = 0;
            foreach (var v in values) { total += v; }
            return total;
        }

        public string Render(int total)
        {
            throw new NotImplementedException("rendering");
        }

        [TestMethod]
        public void TestSum()
        {
            var runner = new Runner();
            var result = runner.Sum(new[] { 1, 2, 3 });
            Console.WriteLine(result);
        }
    }
}
