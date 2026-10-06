using System.Collections.Generic;

namespace Clean
{
    // Rolling average over the last N samples.
    public class Calc
    {
        public double Average(IReadOnlyList<double> samples)
        {
            double total = 0;
            foreach (var s in samples) { total += s; }
            return samples.Count == 0 ? 0 : total / samples.Count;
        }
    }
}
