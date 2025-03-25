const searchModal = document.getElementById('searchModal');
const modalContent = document.querySelector('.modal-content');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const navLinks = document.querySelectorAll('.nav-link');
let selected = '';

/**
 * Filters navigation links based on search input.
 * Supports filtering by `mainTerm` and optional `subTerm`.
 * @param {string} searchTerm - The user's search query.
 */
function filterLinks(searchTerm) {
    const [mainTerm, subTerm] = searchTerm.toLowerCase().split(':/');
    searchResults.innerHTML = ''; // Clear previous results

    const filteredLinks = Array.from(navLinks).filter((link) => {
        const textContent = link.textContent.toLowerCase();
        const searchData = link.getAttribute('searchdata')?.toLowerCase() || '';
        const linkSubTerm = link.getAttribute('subterm')?.toLowerCase() || '';

        const mainMatch = textContent.includes(mainTerm) || searchData.includes(mainTerm);
        const subMatch = subTerm ? (textContent.includes(subTerm) || searchData.includes(subTerm) || linkSubTerm.includes(subTerm)) : true;

        return mainMatch && subMatch;
    });

    if (filteredLinks.length === 0) {
        searchResults.innerHTML = `<p class="text-gray-400 text-sm mt-4">No results found.</p>`;
        return;
    }

    filteredLinks.forEach((link, index) => {
        const resultLink = document.createElement('a');
        resultLink.href = link.href;
        resultLink.textContent = link.textContent;
        resultLink.className =
            'nav-link transition text-gray-600 hover:bg-gray-200 backdrop-blur hover:text-gray-800 group flex items-center px-4 py-2 text-sm font-medium rounded-xl';

        if (index === 0) {
            selected = resultLink.href;
            resultLink.classList.add('bg-gray-200', 'text-gray-900', 'font-semibold', 'searchLinkActive', 'mt-4');
        }

        searchResults.appendChild(resultLink);
    });
}

/**
 * Shows the search modal when `Ctrl + K` or `Cmd + K` is pressed.
 */
document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        showSearchResults();
    }
});

/**
 * Closes the search modal when clicking outside the content.
 */
window.addEventListener('click', (event) => {
    if (event.target === searchModal) {
        modalContent.classList.remove('visible');
        setTimeout(() => searchModal.classList.remove('show'), 300);
    }
});

/**
 * Filters results dynamically as the user types.
 */
searchInput.addEventListener('input', () => filterLinks(searchInput.value));

/**
 * Navigates to the selected search result on pressing Enter.
 */
searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        const activeLink = searchResults.querySelector('.searchLinkActive');
        if (activeLink) activeLink.click();
    }
});

// Initialize search with an empty query
filterLinks('');
          
