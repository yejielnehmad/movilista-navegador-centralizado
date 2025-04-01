import { ProductWithVariants, ProductVariant } from "@/services/productService";
import { Client } from "@/services/clientService";
import { OrderItem, ProcessedOrder } from "@/types/orders";

/**
 * Group detected orders by client
 */
export const groupOrdersByClient = (items: OrderItem[]): Record<string, OrderItem[]> => {
  const groupedOrders: Record<string, OrderItem[]> = {};
  
  items.forEach(item => {
    // Use the matched client name if available, otherwise use the detected name
    const clientKey = (item.clientMatch?.name || item.clientName).toLowerCase().trim();
    if (!groupedOrders[clientKey]) {
      groupedOrders[clientKey] = [];
    }
    groupedOrders[clientKey].push(item);
  });
  
  return groupedOrders;
};

/**
 * Calculate string similarity (Levenshtein distance with normalization)
 */
export const stringSimilarity = (str1: string, str2: string): number => {
  if (!str1 && !str2) return 1.0; // Both empty
  if (!str1 || !str2) return 0.0; // One empty
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Handle exact match quickly
  if (s1 === s2) return 1.0;
  
  // Handle substring match with high similarity
  if (s1.includes(s2) || s2.includes(s1)) {
    const maxLength = Math.max(s1.length, s2.length);
    const minLength = Math.min(s1.length, s2.length);
    return 0.8 + (0.2 * minLength / maxLength); // Gives higher values for closer lengths
  }
  
  // Handle nickname/abbreviation matches (e.g., Daniel → Dani)
  if ((s1.startsWith(s2) || s2.startsWith(s1)) && Math.min(s1.length, s2.length) >= 3) {
    return 0.85; // High confidence for prefix matches with decent length
  }
  
  // For other cases use Levenshtein distance
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
  
  // Normalize and adjust for common typos
  const normalSimilarity = 1 - (track[s2.length][s1.length] / maxLength);
  
  // Give a boost to common typos or small modifications
  if (s1.length > 3 && s2.length > 3 && normalSimilarity > 0.6) {
    // Boost for common character substitutions (i/y, o/u, etc.)
    return Math.min(1.0, normalSimilarity + 0.1);
  }
  
  return normalSimilarity;
};

/**
 * Find similar clients based on name
 */
export const findSimilarClients = (name: string, clients: Client[]): Client[] => {
  if (!name || !clients.length) return [];
  
  // Calculate similarity scores for all clients
  const scoredClients = clients.map(client => ({
    client,
    score: stringSimilarity(name, client.name)
  }));
  
  // Filter and sort by similarity score (highest first)
  return scoredClients
    .filter(item => item.score > 0.6) // Only include reasonably good matches
    .sort((a, b) => b.score - a.score)
    .map(item => item.client);
};

/**
 * Find similar products based on name
 */
export const findSimilarProducts = (
  productName: string,
  products: ProductWithVariants[]
): ProductWithVariants[] => {
  if (!productName || !products.length) return [];
  
  // Calculate similarity scores for all products
  const scoredProducts = products.map(product => ({
    product,
    score: stringSimilarity(productName, product.name)
  }));
  
  // Filter and sort by similarity score (highest first)
  return scoredProducts
    .filter(item => item.score > 0.65) // Higher threshold for products
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);
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
 * Parse a messy natural language order message with improved WhatsApp-style handling
 */
export const parseMessyOrderMessage = (
  message: string, 
  options: { tolerateTypos?: boolean; detectPartialNames?: boolean } = {}
): OrderItem[] => {
  if (!message.trim()) return [];
  
  const { tolerateTypos = false, detectPartialNames = false } = options;
  
  // Break message into segments, handling special characters better
  const lines = message.split(/[\n,;]+/).filter(line => line.trim());
  const orderItems: OrderItem[] = [];
  
  // Process each line or the entire message if no line breaks
  const textToProcess = lines.length > 1 ? lines : [message];
  
  for (const text of textToProcess) {
    // Split into words, preserving numbers with decimals
    const words = text.split(/\s+/).filter(word => word.trim());
    
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
      
      // Skip common connecting words and punctuation
      if (['de', 'y', 'para', 'con', 'el', 'la', 'los', 'las', ',', '.', ':'].includes(word.toLowerCase())) {
        continue;
      }
      
      // State machine for parsing with improved context awareness
      switch (state) {
        case 'client':
          if (isNumber) {
            // Found a quantity, switch to product state
            currentQuantity = parseFloat(word);
            state = 'product';
          } else {
            // Check if this might be a variant code followed by a quantity
            // Common pattern in WhatsApp messages: "Daniel M 3"
            const nextWord = words[i + 1];
            if (word.length <= 2 && nextWord && /^\d+(\.\d+)?$/.test(nextWord)) {
              // This looks like a variant followed by quantity
              if (currentClientName) {
                currentVariantName = word;
                state = 'quantity';
              } else {
                // If no client name yet, this is probably the start of a client name
                currentClientName = word;
              }
            } else {
              // Still building client name
              currentClientName += (currentClientName ? ' ' : '') + word;
              
              // Peek ahead to see if next word is a number or short variant code
              const nextWord = words[i + 1];
              const nextNextWord = words[i + 2]; 
              
              if (nextWord && /^\d+(\.\d+)?$/.test(nextWord)) {
                // Next word is a quantity
                state = 'quantity';
              } else if (nextWord && nextWord.length <= 2 && nextNextWord && /^\d+(\.\d+)?$/.test(nextNextWord)) {
                // Pattern: "name variant quantity"
                state = 'variant';
              }
            }
          }
          break;
          
        case 'variant':
          // This should be a short variant code
          currentVariantName = word;
          state = 'quantity';
          break;
          
        case 'quantity':
          if (isNumber) {
            currentQuantity = parseFloat(word);
            
            // If we have client, variant, and quantity but no product, assume it's a common
            // WhatsApp pattern of "client variant quantity" where product is implied
            if (currentClientName && currentVariantName && !currentProductName) {
              orderItems.push({
                clientName: currentClientName.trim(),
                productName: 'Pañales', // Default product, will be verified later
                variantDescription: currentVariantName,
                quantity: currentQuantity,
                status: 'warning',
                issues: ['Producto inferido del contexto']
              });
              
              // Reset for next item but keep the client name
              currentProductName = '';
              currentVariantName = '';
              currentQuantity = 0;
              state = 'client';
            } else {
              state = 'product';
            }
          } else {
            // If we expected a quantity but got something else,
            // assume it's still part of the client name or it's actually a product
            if (currentVariantName) {
              // We have a variant but no quantity, so this must be a product
              currentProductName = word;
              state = 'quantity'; // Next should be quantity
            } else {
              currentClientName += ' ' + word;
            }
          }
          break;
          
        case 'product':
          // After quantity, we expect product or variant
          // Check if this looks like a short variant code
          if (word.length <= 2) {
            currentVariantName = word;
            
            // Create order item with what we have so far
            if (currentClientName && currentQuantity) {
              orderItems.push({
                clientName: currentClientName.trim(),
                productName: currentProductName.trim() || 'Pañales', // Default if not specified
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
            // Building product name
            currentProductName += (currentProductName ? ' ' : '') + word;
            
            // Peek ahead to see if we might have detected a variant
            const nextWord = words[i + 1];
            if (nextWord && nextWord.length <= 2 && !/^\d+(\.\d+)?$/.test(nextWord)) {
              // Next word looks like a variant
              state = 'variant';
            } else if (i === words.length - 1 || (nextWord && /^\d+(\.\d+)?$/.test(nextWord))) {
              // If this is the last word or next is a number, end the product state
              // and create an order item
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
      }
    }
    
    // Process any remaining state
    if (currentClientName && currentQuantity) {
      // Handle case where we have client, quantity but not product/variant
      if (!currentProductName && !currentVariantName) {
        orderItems.push({
          clientName: currentClientName.trim(),
          productName: 'Pañales', // Default product for this domain
          variantDescription: '',
          quantity: currentQuantity,
          status: 'warning',
          issues: ['Producto inferido, verificar']
        });
      } 
      // Handle case where we have everything except variant
      else if (currentProductName && !currentVariantName) {
        orderItems.push({
          clientName: currentClientName.trim(),
          productName: currentProductName.trim(),
          variantDescription: '',
          quantity: currentQuantity,
          status: 'warning',
          issues: ['No variant specified']
        });
      }
      // Handle case where we have everything
      else if (currentProductName && currentVariantName) {
        orderItems.push({
          clientName: currentClientName.trim(),
          productName: currentProductName.trim(),
          variantDescription: currentVariantName,
          quantity: currentQuantity,
          status: 'warning',
          issues: ['From final state']
        });
      }
    }
  }
  
  // Post-process: merge duplicate client entries
  const mergedItems = new Map<string, OrderItem>();
  
  orderItems.forEach(item => {
    const key = `${item.clientName.toLowerCase()}_${item.productName.toLowerCase()}_${item.variantDescription.toLowerCase()}`;
    
    if (mergedItems.has(key)) {
      // Merge quantities for same client/product/variant
      const existing = mergedItems.get(key)!;
      existing.quantity += item.quantity;
    } else {
      mergedItems.set(key, {...item});
    }
  });
  
  return Array.from(mergedItems.values());
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
    
    // Provide variant suggestions if needed
    const variantSuggestions = productMatch?.variants || [];
    
    return {
      ...item,
      clientMatch,
      productMatch,
      variantMatch,
      variantSuggestions,
      issues,
      status: issues.length ? status : 'valid'
    };
  });
};

// Add specific types for disorganized WhatsApp messages
export interface ParseOptions {
  tolerateTypos?: boolean;
  detectPartialNames?: boolean;
}
