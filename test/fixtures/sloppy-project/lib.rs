// Reporting helpers for the analytics batch.

pub fn average(values: &[f64]) -> f64 {
    // TODO: decide on NaN handling
    let sum: f64 = values.iter().sum();
    sum / values.len() as f64
}

pub fn percentile(values: &[f64], p: f64) -> f64 {
    todo!("percentile not implemented")
}

#[test]
fn test_average() {
    let result = average(&[1.0, 2.0, 3.0]);
    println!("result: {}", result);
}
