import axios from 'axios';

const api = axios.create({
  baseURL: '/', // Changed to use relative URLs since we're using Next.js API routes
  withCredentials: true,  // This is important for sending cookies
  headers: {
    'Content-Type': 'application/json',
  }
});

// Optional: Add response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        await api.post('/api/auth/refresh');
        return api(originalRequest);
      } catch (refreshError) {
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 