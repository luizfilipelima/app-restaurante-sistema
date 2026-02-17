export const getSubdomain = () => {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  
  // Localhost handling
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    // For testing: localhost:3000 -> no subdomain
    // app.localhost:3000 -> app
    // pizzaria.localhost:3000 -> pizzaria
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost') {
      return parts[0];
    }
    return null; // Root domain (localhost)
  }
  
  // Vercel / Production handling
  // e.g. app.quiero.food -> app
  // quiero.food -> null
  // www.quiero.food -> www (treat as null)
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  
  return null; // Root domain
};
