/**
Chirag Gupta
Budget Planner
*/

// main.js
// Handles client-side actions 

document.addEventListener('click', async (e) => {
  // Check if the user clicked the red "Delete" button
  if (e.target.matches('.btn.delete')) {
    const id = e.target.dataset.id;  // get expense id from data-id attribute
    const confirmDelete = confirm('Delete this item?');
    if (!confirmDelete) return;      // stop if user cancels

    try {
      // make DELETE request to server
      const res = await fetch('/delete/' + id, { method: 'DELETE' });

      if (res.ok) {
        // remove the row from table instantly
        e.target.closest('tr').remove();
        // reload totals and suggestion section
        location.reload();
      } else {
        alert('Failed to delete. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Error while deleting.');
    }
  }
});
