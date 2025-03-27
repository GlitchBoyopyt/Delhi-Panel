const axios = require('axios');

/**
 * Makes an authenticated request to the HydraDaemon API.
 * @param {Object} instance - The instance object.
 * @param {string} method - The HTTP method (GET, POST, DELETE).
 * @param {string} endpoint - The API endpoint.
 * @param {Object} [data] - Optional data for POST requests.
 * @returns {Promise<Object|null>} - The response data or null on failure.
 */
async function makeRequest(instance, method, endpoint, data = null) {
    const url = `http://${instance.Node.address}:${instance.Node.port}${endpoint}`;
    try {
        const response = await axios({
            method,
            url,
            auth: { username: 'Skyport', password: instance.Node.apiKey },
            data,
        });
        return response.data;
    } catch (error) {
        console.error(`Error during ${method} request to ${url}:`, error.response?.data || error.message);
        return null;
    }
}

/**
 * Fetches files for a given instance.
 * @param {Object} instance - The instance object.
 * @param {string} [path=''] - The path to fetch files from.
 * @returns {Promise<Array>} - The list of files.
 */
async function fetchFiles(instance, path = '') {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return (await makeRequest(instance, 'GET', `/fs/${instance.VolumeId}/files${query}`))?.files || [];
}

/**
 * Fetches content of a specific file.
 * @param {Object} instance - The instance object.
 * @param {string} filename - The name of the file to fetch.
 * @param {string} [path=''] - The path of the file.
 * @returns {Promise<string|null>} - The content of the file or null on failure.
 */
async function fetchFileContent(instance, filename, path = '') {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return (await makeRequest(instance, 'GET', `/fs/${instance.VolumeId}/files/view/${filename}${query}`))?.content || null;
}

/**
 * Creates a new file.
 * @param {Object} instance - The instance object.
 * @param {string} filename - The name of the file.
 * @param {string} content - The content of the file.
 * @param {string} [path=''] - The path where to create the file.
 * @returns {Promise<Object|null>} - The response from the server.
 */
async function createFile(instance, filename, content, path = '') {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return await makeRequest(instance, 'POST', `/fs/${instance.VolumeId}/files/create/${filename}${query}`, { content });
}

/**
 * Edits an existing file.
 * @param {Object} instance - The instance object.
 * @param {string} filename - The name of the file.
 * @param {string} content - The new content of the file.
 * @param {string} [path=''] - The path of the file.
 * @returns {Promise<Object|null>} - The response from the server.
 */
async function editFile(instance, filename, content, path = '') {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return await makeRequest(instance, 'POST', `/fs/${instance.VolumeId}/files/edit/${filename}${query}`, { content });
}

/**
 * Deletes a file.
 * @param {Object} instance - The instance object.
 * @param {string} filename - The name of the file to delete.
 * @param {string} [path=''] - The path of the file.
 * @returns {Promise<Object|null>} - The response from the server.
 */
async function deleteFile(instance, filename, path = '') {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    return await makeRequest(instance, 'DELETE', `/fs/${instance.VolumeId}/files/delete/${filename}${query}`);
}

module.exports = {
    fetchFiles,
    fetchFileContent,
    createFile,
    editFile,
    deleteFile
};
