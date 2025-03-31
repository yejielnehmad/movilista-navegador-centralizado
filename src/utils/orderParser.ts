
import { ProductWithVariants, ProductVariant } from "@/services/productService";
import { Client } from "@/services/clientService";
import { OrderItem, ProcessedOrder } from "@/types/orders";

/**
 * Parse a natural language order message and extract order items
 */
export const parseOrderMessage = (message: string): OrderItem[] => {
  if (!message.trim()) return [];
  
  // Basic extraction of name, quantity, and product
  const lines = message.split('\n').filter(line => line.trim());
  const orderItems: OrderItem[] = [];
  
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;
    
    // Pattern: [Client Name] [Quantity] [Unit] of [Product]
    // Example: "Daniel 5 kilos of chicken"
    const regex = /^([^0-9]+?)(\d+(?:\.\d+)?)\s*(kilos?|kg|g|gramos?|litros?|l|ml|unidades?|piezas?|packs?|cajas?)?\s*(?:de\s*)?(.+?)$/i;
    const match = cleanLine.match(regex);
    
    if (match) {
      // Extract components
      const [, clientName, quantity, unit, productName] = match;
      
      // Create order item
      orderItems.push({
        clientName: clientName.trim(),
        productName: productName.trim(),
        variantDescription: unit ? `${quantity} ${unit}` : quantity,
        quantity: parseFloat(quantity),
        status: 'warning', // Default to warning until validated
        issues: ['Needs validation']
      });
    } else {
      // Handle lines that don't match the expected pattern
      // Simple fallback: first word is client, rest is product
      const parts = cleanLine.split(' ');
      if (parts.length >= 2) {
        const clientName = parts[0];
        // Check if the second word is a number (quantity)
        const quantityMatch = parts[1].match(/^(\d+(?:\.\d+)?)$/);
        
        if (quantityMatch) {
          const quantity = parseFloat(quantityMatch[1]);
          const remainingText = parts.slice(2).join(' ');
          
          orderItems.push({
            clientName: clientName.trim(),
            productName: remainingText.trim(),
            variantDescription: quantity.toString(),
            quantity,
            status: 'warning',
            issues: ['Unclear format, needs verification']
          });
        } else {
          // No clear quantity, assume entire rest is product
          orderItems.push({
            clientName: clientName.trim(),
            productName: parts.slice(1).join(' ').trim(),
            variantDescription: '1',
            quantity: 1,
            status: 'warning',
            issues: ['No quantity specified, assuming 1']
          });
        }
      } else if (parts.length === 1) {
        // Only one word in the line
        orderItems.push({
          clientName: parts[0].trim(),
          productName: '',
          variantDescription: '',
          quantity: 0,
          status: 'error',
          issues: ['Incomplete order, missing product']
        });
      }
    }
  }
  
  return orderItems;
};

/**
 * Validate order items against the database
 */
export const validateOrderItems = (
  items: OrderItem[],
  clients: Client[],
  products: ProductWithVariants[]
): OrderItem[] => {
  return items.map(item => {
    const issues: string[] = [];
    let status: 'valid' | 'warning' | 'error' = 'valid';
    
    // Validate client
    const clientMatch = findMatchingClient(item.clientName, clients);
    if (!clientMatch) {
      issues.push(`Client "${item.clientName}" not found in database`);
      status = 'error';
    }
    
    // Validate product and variant
    const { productMatch, variantMatch, productIssues } = findMatchingProduct(
      item.productName,
      item.variantDescription,
      item.quantity,
      products
    );
    
    if (productIssues.length > 0) {
      issues.push(...productIssues);
      status = issues.some(i => i.includes('not found')) ? 'error' : 'warning';
    }
    
    return {
      ...item,
      clientMatch,
      productMatch,
      variantMatch,
      issues,
      status: issues.length ? status : 'valid'
    };
  });
};

/**
 * Find a matching client by name (fuzzy match)
 */
const findMatchingClient = (name: string, clients: Client[]): Client | null => {
  if (!name || !clients.length) return null;
  
  // Normalize the name
  const searchName = name.toLowerCase().trim();
  
  // Try exact match first
  const exactMatch = clients.find(
    client => client.name.toLowerCase() === searchName
  );
  
  if (exactMatch) return exactMatch;
  
  // Try partial match (client name contains search or vice versa)
  const partialMatch = clients.find(
    client => 
      client.name.toLowerCase().includes(searchName) || 
      searchName.includes(client.name.toLowerCase())
  );
  
  return partialMatch || null;
};

/**
 * Find a matching product and variant
 */
const findMatchingProduct = (
  productName: string,
  variantDesc: string,
  quantity: number,
  products: ProductWithVariants[]
): {
  productMatch: ProductWithVariants | null;
  variantMatch: ProductVariant | null;
  productIssues: string[];
} => {
  const productIssues: string[] = [];
  
  if (!productName || !products.length) {
    return { 
      productMatch: null,
      variantMatch: null,
      productIssues: ['No product specified']
    };
  }
  
  // Normalize the product name
  const searchName = productName.toLowerCase().trim();
  
  // Find product (exact or fuzzy match)
  const productMatch = products.find(
    p => p.name.toLowerCase() === searchName
  ) || products.find(
    p => p.name.toLowerCase().includes(searchName) || 
         searchName.includes(p.name.toLowerCase())
  );
  
  if (!productMatch) {
    return {
      productMatch: null,
      variantMatch: null,
      productIssues: [`Product "${productName}" not found in catalog`]
    };
  }
  
  // Check if the product has variants
  if (!productMatch.variants || productMatch.variants.length === 0) {
    return {
      productMatch,
      variantMatch: null,
      productIssues: ['Product has no variants available']
    };
  }
  
  // Find a matching variant based on description
  // This is a simple implementation - could be enhanced with more sophisticated matching
  let variantMatch: ProductVariant | null = null;
  
  // Try to match based on the variant description and quantity
  const variantDesc_lower = variantDesc.toLowerCase();
  variantMatch = productMatch.variants.find(v => 
    v.name.toLowerCase().includes(variantDesc_lower) ||
    variantDesc_lower.includes(v.name.toLowerCase())
  );
  
  if (!variantMatch) {
    return {
      productMatch,
      variantMatch: null,
      productIssues: ['Specified variant not found, please select a variant']
    };
  }
  
  return { productMatch, variantMatch, productIssues: [] };
};
