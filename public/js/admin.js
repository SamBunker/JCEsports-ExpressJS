function showActionGroup(action) {
    // Hide all action groups first
    const actionGroups = document.querySelectorAll('.btn-group');
    actionGroups.forEach(group => {
        group.style.display = 'none';
    });

    // Show the selected action group based on the dropdown selection
    const selectedGroup = document.getElementById(action);
    if (selectedGroup) {
        selectedGroup.style.display = 'block';
    }
}

function hideAllDivs() {
    // Get all divs that are control sections and hide them
    const allDivs = document.querySelectorAll('[id^="new"], [id^="edit"], [id^="delete"], [id^="admin"]');
    allDivs.forEach(div => {
        div.style.display = 'none';
    });
}

function showDiv(divId) {
    // Hide all sections first
    hideAllDivs();

    // Show the selected section
    const div = document.getElementById(divId);
    if (div) {
        div.style.display = 'block';
    }
}

function submitDeleteForm(userId) {
    // Set the userId in the hidden input field
    document.getElementById('userIdInput').value = userId;

    // Submit the hidden form
    document.getElementById('deleteUserForm').submit();
}