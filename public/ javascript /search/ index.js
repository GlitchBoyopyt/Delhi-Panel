const searchModal = document.getElementById('searchModal');
const modalContent = document.querySelector('.modal-content');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const navLinks = document.querySelectorAll('.nav-link');
let selectedIndex = -1;

// Panel Installation AI Responses
const aiResponses = {
    "panel install": [
        "Step 1: Download the panel source code.",
        "Step 2: Install dependencies using `npm install`.",
        "Step 3: Setup database using `mysql -u root -p`.",
        "Step 4: Start the panel using `npm start`.",
        "Step 5: Open your browser and go to `http://localhost:3000`."
    ],
    "how to install": [
        "Step 1: Identify the software you want to install.",
        "Step 2: Download the required dependencies.",
        "Step 3: Follow the installation guide or run `setup.sh`.",
        "Step 4: Configure the settings as per documentation.",
        "Step 5: Restart your system and verify the installation."
    ]
};

// Function to filter and display links
function filterLinks(searchTerm) {
    const [mainTerm, subTerm] = searchTerm.toLowerCase().split(':/');
    const filteredLinks = Array.from(navLinks).filter(link => {
        const textContent = link.textContent.toLowerCase();
        const searchData = link.getAttribute('searchdata')?.toLowerCase();
        const linkSubTerm = link.getAttribute('subterm')?.toLowerCase();

        return (textContent.includes(mainTerm) || (searchData && searchData.includes(mainTerm))) &&
               (!subTerm || (textContent.includes(subTerm) || (linkSubTerm && linkSubTerm.includes(subTerm))));
    });

    searchResults.innerHTML = '';
    selectedIndex = -1;  // Reset selection index

    if (filteredLinks.length === 0) {
        // Check if AI has a response
        let aiResponse = Object.keys(aiResponses).find(key => searchTerm.includes(key));
        if (aiResponse) {
            searchResults.innerHTML = aiResponses[aiResponse].map(step => `<p class="text-blue-500">${step}</p>`).join('');
        } else {
            searchResults.innerHTML = `<p class="text-gray-400 text-sm mt-4">No results found. Try searching for "panel install".</p>`;
        }
    } else {
        filteredLinks.forEach((link, index) => {
            const resultLink = document.createElement('a');
            resultLink.href = link.href;
            resultLink.textContent = link.textContent;
            resultLink.classList.add(
                'nav-link', 'transition', 'text-gray-600',
                'hover:bg-gray-200', 'hover:text-gray-800',
                'group', 'flex', 'items-center',
                'px-4', 'py-2', 'text-sm', 'font-medium',
                'rounded-xl'
            );

            if (index === 0) {
                resultLink.classList.add('bg-gray-200', 'text-gray-900', 'font-semibold', 'searchLinkActive', 'mt-4');
            }

            searchResults.appendChild(resultLink);
        });
    }
}

// Open search modal with CTRL + K
document.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchModal.classList.add('show');
        modalContent.classList.add('visible');
        searchInput.focus();
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        navigateResults(event.key === 'ArrowDown' ? 1 : -1);
    }

    if (event.key === 'Enter' && selectedIndex >= 0) {
        event.preventDefault();
        const selectedLink = searchResults.children[selectedIndex];
        if (selectedLink) selectedLink.click();
    }
});

// Hide modal on click outside
window.addEventListener('click', (event) => {
    if (event.target === searchModal) {
        modalContent.classList.remove('visible');
        setTimeout(() => {
            searchModal.classList.remove('show');
        }, 300);
    }
});

// Handle search input
searchInput.addEventListener('input', () => {
    filterLinks(searchInput.value.toLowerCase());
});

// Navigate search results using arrow keys
function navigateResults(direction) {
    const links = searchResults.querySelectorAll('.nav-link');
    if (links.length === 0) return;

    selectedIndex = (selectedIndex + direction + links.length) % links.length;
    links.forEach(link => link.classList.remove('bg-gray-200', 'text-gray-900'));
    links[selectedIndex].classList.add('bg-gray-200', 'text-gray-900');
              }
  
