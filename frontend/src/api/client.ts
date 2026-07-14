import { storage } from '@/src/utils/storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const token = await storage.secureGet('session_token', null);
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async get<T>(endpoint: string): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }

  async delete(endpoint: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
  }
}

export const apiClient = new ApiClient();
