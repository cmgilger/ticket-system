// Shows the panel (card fields / PayPal button / Apple Pay button)
// that matches the selected payment method on the mock checkout.
document.querySelectorAll('input[name="method"]').forEach(function(radio) {
  radio.addEventListener('change', function() {
    document.querySelectorAll('.pay-panel').forEach(function(panel) {
      panel.hidden = panel.dataset.method !== radio.value;
    });
  });
});
