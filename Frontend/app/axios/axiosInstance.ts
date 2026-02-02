import axios from 'axios';

const BACK_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

const axiosInstance = axios.create({
  baseURL: BACK_URL,
  withCredentials: true
});

export default axiosInstance;