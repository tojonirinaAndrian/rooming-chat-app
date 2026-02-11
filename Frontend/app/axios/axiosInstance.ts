import axios from 'axios';

const BACK_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

const axiosInstance = axios.create({
  baseURL: BACK_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

export default axiosInstance;