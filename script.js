document.addEventListener('DOMContentLoaded', () => {
    let db;
    let currentSection = '';
    const DB_NAME = 'PlannerDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'urls';
    initDB();
    function initDB() {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = e => console.error('Database error:', e.target.error);
        request.onsuccess = e => {
            db = e.target.result;
            loadSection(currentSection);
        };
        request.onupgradeneeded = e => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('section', 'section', { unique: false });
                store.createIndex('completed', 'completed', { unique: false });
            }
        };
    }
    function saveURL(url, tag) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const urlData = {
            url,
            tag,
            section: currentSection,
            completed: false,
            date: new Date().toISOString()
        };
        store.add(urlData).onsuccess = () => loadSection(currentSection);
    }
    function toggleComplete(id) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = e => {
            const data = e.target.result;
            data.completed = !data.completed;
            store.put(data).onsuccess = () => {
                const item = document.querySelector(`[data-id="${id}"]`);
                if (item) {
                    item.classList.add('fade-out');
                    setTimeout(() => {
                        loadSection(currentSection);
                    }, 300);
                }
            };
        };
    }
    function deleteURL(id) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(id).onsuccess = () => {
            const item = document.querySelector(`[data-id="${id}"]`);
            if (item) {
                item.classList.add('fade-out');
                setTimeout(() => {
                    loadSection(currentSection);
                }, 300);
            }
        };
    }
    function createURLItem(data) {
        const li = document.createElement('li');
        li.className = 'url-item';
        li.dataset.id = data.id;
        li.innerHTML = `
            <div class="url-content">
                <a href="${data.url}" target="_blank" class="url-link">${data.url}</a>
                <div class="url-actions">
                    <button class="action-btn toggle" title="${data.completed ? 'Mark incomplete' : 'Mark complete'}">
                        <i class="fas fa-${data.completed ? 'undo' : 'check'}"></i>
                    </button>
                    <button class="action-btn delete" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="url-meta">
                <span class="tag">Tag: ${data.tag}</span>
                <span class="date">Added: ${new Date(data.date).toLocaleDateString()}</span>
            </div>
        `;
        li.querySelector('.toggle').onclick = () => toggleComplete(data.id);
        li.querySelector('.delete').onclick = () => {
            if (confirm('Delete this URL?')) deleteURL(data.id);
        };
        return li;
    }
    function loadSection(section) {
        if (!db) return;
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('section');
        const request = index.getAll(section);
        request.onsuccess = e => {
            const urls = e.target.result;
            const pending = document.querySelector('#pending .url-list');
            const completed = document.querySelector('#completed .url-list');
            pending.innerHTML = '';
            completed.innerHTML = '';
            urls.forEach(url => {
                const item = createURLItem(url);
                if (url.completed) {
                    completed.appendChild(item);
                } else {
                    pending.appendChild(item);
                }
            });
            updateCharts(urls);
        };
    }
    function updateCharts(urls) {
        const completionCtx = document.getElementById('completion-chart').getContext('2d');
        const timelineCtx = document.getElementById('timeline-chart').getContext('2d');
        const distributionCtx = document.getElementById('distribution-chart').getContext('2d');
    
        // Get data by section
        const sectionData = {
            'writeups': urls.filter(u => u.section === 'writeups'),
            'hackerone-reports': urls.filter(u => u.section === 'hackerone-reports'),
            'videos': urls.filter(u => u.section === 'videos'),
            'labs': urls.filter(u => u.section === 'labs')
        };
    
        // Completion status by section
        new Chart(completionCtx, {
            type: 'bar',
            data: {
                labels: ['Writeups', 'HackerOne Reports', 'Videos', 'Labs'],
                datasets: [
                    {
                        label: 'Completed',
                        data: Object.values(sectionData).map(items => 
                            items.filter(u => u.completed).length
                        ),
                        backgroundColor: '#2ecc71'
                    },
                    {
                        label: 'Pending',
                        data: Object.values(sectionData).map(items => 
                            items.filter(u => !u.completed).length
                        ),
                        backgroundColor: '#e74c3c'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    xAxes: [{
                        stacked: true,
                        gridLines: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }],
                    yAxes: [{
                        stacked: true,
                        ticks: { 
                            beginAtZero: true,
                            fontColor: '#fff'
                        },
                        gridLines: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }]
                },
                legend: {
                    labels: {
                        fontColor: '#fff'
                    }
                }
            }
        });
    
        // Timeline showing items added over time
        const timelineData = {};
        urls.forEach(url => {
            const date = new Date(url.date).toLocaleDateString();
            timelineData[date] = (timelineData[date] || 0) + 1;
        });
    
        new Chart(timelineCtx, {
            type: 'line',
            data: {
                labels: Object.keys(timelineData),
                datasets: [{
                    label: 'Items Added',
                    data: Object.values(timelineData),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    xAxes: [{
                        gridLines: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            fontColor: '#fff'
                        }
                    }],
                    yAxes: [{
                        ticks: { 
                            beginAtZero: true,
                            fontColor: '#fff'
                        },
                        gridLines: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }]
                },
                legend: {
                    labels: {
                        fontColor: '#fff'
                    }
                }
            }
        });
    
        // Distribution pie chart
        new Chart(distributionCtx, {
            type: 'pie',
            data: {
                labels: ['Writeups', 'HackerOne Reports', 'Videos', 'Labs'],
                datasets: [{
                    data: Object.values(sectionData).map(items => items.length),
                    backgroundColor: [
                        '#2ecc71',  // Green
                        '#e74c3c',  // Red
                        '#f1c40f',  // Yellow
                        '#9b59b6'   // Purple
                    ]
                }]
            },
            options: {
                responsive: true,
                legend: {
                    position: 'bottom',
                    labels: {
                        fontColor: '#fff',
                        padding: 20
                    }
                },
                tooltips: {
                    callbacks: {
                        label: function(tooltipItem, data) {
                            const dataset = data.datasets[0];
                            const total = dataset.data.reduce((acc, curr) => acc + curr, 0);
                            const value = dataset.data[tooltipItem.index];
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${data.labels[tooltipItem.index]}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        });
    }
    document.getElementById('nav-menu').addEventListener('click', e => {
        const li = e.target.closest('li');
        if (!li) return;
        currentSection = li.dataset.section;
        document.getElementById('section-title').textContent = li.textContent.trim();
        document.getElementById('url-form').style.display = 
            currentSection === 'charts' ? 'none' : 'block';
        document.querySelector('.lists-container').style.display = 
            currentSection === 'charts' ? 'none' : 'grid';
        document.querySelector('.charts-container').style.display = 
        currentSection === 'charts' ? 'grid' : 'none';
        document.querySelectorAll('#nav-menu li').forEach(li => {
            li.classList.toggle('active', li.dataset.section === currentSection);
        });
        loadSection(currentSection);
    });

    document.getElementById('save-urls').addEventListener('click', () => {
        const urlsInput = document.getElementById('urls-input');
        const tagInput = document.getElementById('url-tag');
        const urls = urlsInput.value.split('\n').filter(url => url.trim());
        const tag = tagInput.value.trim();

        if (!urls.length) {
            alert('Please enter at least one URL');
            return;
        }

        if (!tag) {
            alert('Please enter a tag');
            return;
        }

        urls.forEach(url => {
            if (url.trim()) {
                saveURL(url.trim(), tag);
            }
        });

        urlsInput.value = '';
        tagInput.value = '';
    });

    // Set initial section
    const defaultSection = document.querySelector('#nav-menu li').dataset.section;
    document.querySelector(`[data-section="${defaultSection}"]`).click();

    // Enable drag and drop functionality
    document.querySelectorAll('.url-list').forEach(list => {
        list.addEventListener('dragover', e => {
            e.preventDefault();
            const draggingItem = document.querySelector('.dragging');
            if (draggingItem) {
                const afterElement = getDragAfterElement(list, e.clientY);
                if (afterElement) {
                    list.insertBefore(draggingItem, afterElement);
                } else {
                    list.appendChild(draggingItem);
                }
            }
        });
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.url-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            document.getElementById('save-urls').click();
        }
    });

    // Add search functionality
    const searchUrls = (query) => {
        document.querySelectorAll('.url-item').forEach(item => {
            const url = item.querySelector('.url-link').textContent.toLowerCase();
            const tag = item.querySelector('.tag').textContent.toLowerCase();
            const matches = url.includes(query) || tag.includes(query);
            item.style.display = matches ? 'flex' : 'none';
        });
    };

    // Add export functionality
    window.exportData = () => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const data = request.result;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `planner-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
    };

    // Enable offline functionality
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.error('ServiceWorker registration failed:', err);
            });
    }
});