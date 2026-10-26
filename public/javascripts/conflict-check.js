// "+ Add another" buttons on the conflict check form. Without
// JavaScript the form still works with the starting number of boxes;
// that's why the buttons start hidden and are revealed here.
document.querySelectorAll('.party-group').forEach(function(group) {
  var button = group.querySelector('.add-party');
  var rows = group.querySelector('.party-rows');
  button.hidden = false;
  button.addEventListener('click', function() {
    var input = rows.querySelector('input').cloneNode();
    input.value = '';
    rows.appendChild(input);
    input.focus();
  });
});
