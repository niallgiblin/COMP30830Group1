function openModal(id) {
    // Hide all modals
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    // Show selected modal
    document.getElementById(id).style.display = 'block';
  }
  
  function closeModal(id) {
    document.getElementById(id).style.display = 'none';
  }
  
  // Close modals if clicked outside
  window.addEventListener('click', function(event) {
    document.querySelectorAll('.modal').forEach(modal => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });
  });
  
  // Make functions available globally
  window.openModal = openModal;
  window.closeModal = closeModal;
  