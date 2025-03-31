import { ProductWithVariants, ProductVariant } from "@/services/productService";
import { Client } from "@/services/clientService";
import { OrderItem, ProcessedOrder } from "@/types/orders";

/**
 * Group detected orders by client
 */
export const groupOrdersByClient = (items: OrderItem[]): Record<string, OrderItem[]> => {
  const groupedOrders: Record<string, OrderItem[]> = {};
  
  items.forEach(item => {
    const clientKey = item.clientName.toLowerCase().trim();
    if (!groupedOrders[clientKey]) {
      groupedOrders[clientKey] = [];
    }
    groupedOrders[clientKey].push(item);
  });
  
  return groupedOrders;
};

/**
 * Calculate string similarity (Levenshtein distance)
 */
export const stringSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  const track = Array(s2.length + 1).fill(null).map(() => 
    Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  
  // Normalize distance to a similarity value between 0 and 1
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0; // Both strings are empty
  
  return 1 - (track[s2.length][s1.length] / maxLength);
};

/**
 * Find best matching client by name with fuzzy matching
 */
export const findBestMatchingClient = (name: string, clients: Client[]): Client | null => {
  if (!name || !clients.length) return null;
  
  // Normalize the name and remove common noise words
  const searchName = name.toLowerCase().trim();
  
  // Try exact match first
  const exactMatch = clients.find(
    client => client.name.toLowerCase() === searchName
  );
  
  if (exactMatch) return exactMatch;
  
  // Try fuzzy match based on similarity score
  let bestMatch: Client | null = null;
  let bestScore = 0.7; // Threshold for minimum similarity (0 to 1)
  
  clients.forEach(client => {
    const score = stringSimilarity(searchName, client.name.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestMatch = client;
    }
  });
  
  return bestMatch;
};

/**
 * Find best matching product with fuzzy matching
 */
export const findBestMatchingProduct = (
  productName: string,
  products: ProductWithVariants[]
): ProductWithVariants | null => {
  if (!productName || !products.length) return null;

  // Normalize the product name
  const searchName = productName.toLowerCase().trim();
  
  // Try exact match first
  const exactMatch = products.find(
    p => p.name.toLowerCase() === searchName
  );
  
  if (exactMatch) return exactMatch;
  
  // Try fuzzy match based on similarity score
  let bestMatch: ProductWithVariants | null = null;
  let bestScore = 0.7; // Threshold for minimum similarity (0 to 1)
  
  products.forEach(product => {
    const score = stringSimilarity(searchName, product.name.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  });
  
  return bestMatch;
};

/**
 * Find best matching variant with fuzzy matching
 */
export const findBestMatchingVariant = (
  variantDesc: string, 
  variants: ProductVariant[]
): ProductVariant | null => {
  if (!variantDesc || !variants.length) return null;
  
  // Normalize the variant description
  const searchDesc = variantDesc.toLowerCase().trim();
  
  // Try exact match first
  const exactMatch = variants.find(
    v => v.name.toLowerCase() === searchDesc
  );
  
  if (exactMatch) return exactMatch;
  
  // Try fuzzy match based on similarity score
  let bestMatch: ProductVariant | null = null;
  let bestScore = 0.7; // Threshold for minimum similarity (0 to 1)
  
  variants.forEach(variant => {
    const score = stringSimilarity(searchDesc, variant.name.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestMatch = variant;
    }
  });
  
  return bestMatch;
};

/**
 * Parse a messy natural language order message
 */
export const parseMessyOrderMessage = (message: string): OrderItem[] => {
  if (!message.trim()) return [];
  
  // Break message into segments
  const words = message.split(/\s+/);
  const orderItems: OrderItem[] = [];
  
  let currentClientName = '';
  let currentQuantity = 0;
  let currentProductName = '';
  let currentVariantName = '';
  let state: 'client' | 'quantity' | 'product' | 'variant' = 'client';
  
  // Process words one by one to build order items
  for (let i = 0; i < words.length; i++) {
    const word = words[i].trim();
    if (!word) continue;
    
    const isNumber = /^\d+(\.\d+)?$/.test(word);
    
    // Skip common connecting words
    if (['de', 'y', 'para', 'con'].includes(word.toLowerCase())) {
      continue;
    }
    
    // State machine for parsing
    switch (state) {
      case 'client':
        if (isNumber) {
          // Found a quantity, switch to product state
          currentQuantity = parseFloat(word);
          state = 'product';
        } else {
          // Still building client name
          currentClientName += (currentClientName ? ' ' : '') + word;
          
          // Peek ahead to see if next word is a number
          const nextWord = words[i + 1];
          if (nextWord && /^\d+(\.\d+)?$/.test(nextWord)) {
            state = 'quantity';
          }
        }
        break;
        
      case 'quantity':
        if (isNumber) {
          currentQuantity = parseFloat(word);
          state = 'product';
        } else {
          // If we expected a quantity but got something else,
          // assume it's still part of the client name
          currentClientName += ' ' + word;
        }
        break;
        
      case 'product':
        // Assume the word after quantity is product or variant
        // Simple heuristic: short words (1-2 chars) are likely variants
        if (word.length <= 2) {
          currentVariantName = word;
          
          // Create order item and reset for next item
          if (currentClientName && currentQuantity) {
            orderItems.push({
              clientName: currentClientName.trim(),
              productName: currentProductName.trim() || 'Unknown',
              variantDescription: currentVariantName,
              quantity: currentQuantity,
              status: 'warning',
              issues: ['From pattern matching']
            });
          }
          
          // Reset for next item but keep the client
          currentProductName = '';
          currentVariantName = '';
          currentQuantity = 0;
          state = 'client';
        } else {
          currentProductName += (currentProductName ? ' ' : '') + word;
          
          // Peek ahead to determine if we might have detected a variant
          const nextWord = words[i + 1];
          if (nextWord && nextWord.length <= 2 && !/^\d+(\.\d+)?$/.test(nextWord)) {
            state = 'variant';
          } else if (i === words.length - 1 || (nextWord && /^\d+(\.\d+)?$/.test(nextWord))) {
            // If this is the last word or next is a number, end the product state
            if (currentClientName && currentQuantity) {
              orderItems.push({
                clientName: currentClientName.trim(),
                productName: currentProductName.trim(),
                variantDescription: '',
                quantity: currentQuantity,
                status: 'warning',
                issues: ['No variant specified']
              });
            }
            
            // Reset product and quantity but keep client for potential next item
            currentProductName = '';
            currentQuantity = 0;
            // Next word might be quantity for same client or new client
            state = nextWord && /^\d+(\.\d+)?$/.test(nextWord) ? 'quantity' : 'client';
          }
        }
        break;
        
      case 'variant':
        currentVariantName = word;
        
        // Create order item and reset for next item
        if (currentClientName && currentQuantity) {
          orderItems.push({
            clientName: currentClientName.trim(),
            productName: currentProductName.trim() || 'Unknown',
            variantDescription: currentVariantName,
            quantity: currentQuantity,
            status: 'warning',
            issues: ['From pattern matching']
          });
        }
        
        // Reset for next item but keep the client
        currentProductName = '';
        currentVariantName = '';
        currentQuantity = 0;
        state = 'client';
        break;
    }
  }
  
  // Process any remaining state
  if (currentClientName && currentQuantity && (currentProductName || currentVariantName)) {
    orderItems.push({
      clientName: currentClientName.trim(),
      productName: currentProductName.trim() || 'Unknown',
      variantDescription: currentVariantName,
      quantity: currentQuantity,
      status: 'warning',
      issues: ['From final state']
    });
  }
  
  return orderItems;
};

/**
 * Validate and match detected order items against database
 */
export const validateAndMatchOrders = (
  items: OrderItem[],
  clients: Client[],
  products: ProductWithVariants[]
): OrderItem[] => {
  return items.map(item => {
    const issues: string[] = [];
    let status: 'valid' | 'warning' | 'error' = 'valid';
    
    // Find best matching client
    const clientMatch = findBestMatchingClient(item.clientName, clients);
    if (!clientMatch) {
      issues.push(`No se encontró el cliente "${item.clientName}"`);
      status = 'error';
    }
    
    // Find best matching product
    const productMatch = findBestMatchingProduct(item.productName, products);
    if (!productMatch) {
      issues.push(`No se encontró el producto "${item.productName}"`);
      status = 'error';
    }
    
    // Find best matching variant if product exists
    let variantMatch: ProductVariant | null = null;
    if (productMatch) {
      const variants = productMatch.variants as ProductVariant[];
      if (variants.length === 0) {
        issues.push(`El producto no tiene variantes disponibles`);
        status = status === 'error' ? 'error' : 'warning';
      } else if (item.variantDescription) {
        variantMatch = findBestMatchingVariant(item.variantDescription, variants);
        if (!variantMatch) {
          issues.push(`No se encontró la variante "${item.variantDescription}"`);
          status = status === 'error' ? 'error' : 'warning';
        }
      } else {
        // No variant specified
        issues.push('No se especificó variante, seleccione una');
        status = status === 'error' ? 'error' : 'warning';
      }
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
