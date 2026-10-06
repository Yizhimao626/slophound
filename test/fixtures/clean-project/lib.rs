// Reverses the input string.
pub fn reverse(s: &str) -> String {
    s.chars().rev().collect()
}

#[test]
fn test_reverse() {
    assert_eq!(reverse("abc"), String::from("cba"));
}
