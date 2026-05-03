import axios from 'axios';

// IP de Tailscale de PC Fedora (donde corre el Gateway)
const GATEWAY_URL = "http://100.119.151.81:3000/api/v1"; 

const api = axios.create({
  baseURL: GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;