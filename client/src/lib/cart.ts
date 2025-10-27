/**
 * Cart Persistence System
 * 
 * Provides localStorage-based cart persistence for better UX.
 * Syncs with server-side cart using sessionId for anonymous users.
 */

const SESSION_ID_KEY = "eaas_session_id";
const CART_ITEMS_KEY = "eaas_cart_items";

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  productName?: string;
  variantName?: string;
  price?: string;
  image?: string;
}

/**
 * Gets or creates a persistent session ID
 * Used to track anonymous user carts across page reloads
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  
  if (!sessionId) {
    // Generate random session ID
    sessionId = `session_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Get cart items from localStorage
 */
export function getLocalCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  
  try {
    const items = localStorage.getItem(CART_ITEMS_KEY);
    return items ? JSON.parse(items) : [];
  } catch (error) {
    console.error("Error loading cart from localStorage:", error);
    return [];
  }
}

/**
 * Save cart items to localStorage
 */
export function saveLocalCartItems(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Error saving cart to localStorage:", error);
  }
}

/**
 * Add item to local cart
 */
export function addToLocalCart(item: CartItem): CartItem[] {
  const items = getLocalCartItems();
  
  // Find existing item (same product + variant)
  const existingIndex = items.findIndex(
    i => i.productId === item.productId && i.variantId === item.variantId
  );
  
  if (existingIndex >= 0) {
    // Update quantity
    items[existingIndex].quantity += item.quantity;
  } else {
    // Add new item
    items.push(item);
  }
  
  saveLocalCartItems(items);
  return items;
}

/**
 * Update item quantity in local cart
 */
export function updateLocalCartItem(
  productId: string, 
  variantId: string | undefined, 
  quantity: number
): CartItem[] {
  const items = getLocalCartItems();
  
  const itemIndex = items.findIndex(
    i => i.productId === productId && i.variantId === variantId
  );
  
  if (itemIndex >= 0) {
    if (quantity <= 0) {
      // Remove item
      items.splice(itemIndex, 1);
    } else {
      // Update quantity
      items[itemIndex].quantity = quantity;
    }
  }
  
  saveLocalCartItems(items);
  return items;
}

/**
 * Remove item from local cart
 */
export function removeFromLocalCart(
  productId: string, 
  variantId?: string
): CartItem[] {
  const items = getLocalCartItems();
  
  const filtered = items.filter(
    i => !(i.productId === productId && i.variantId === variantId)
  );
  
  saveLocalCartItems(filtered);
  return filtered;
}

/**
 * Clear local cart
 */
export function clearLocalCart(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_ITEMS_KEY);
}

/**
 * Get cart item count
 */
export function getCartItemCount(): number {
  const items = getLocalCartItems();
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Migrate anonymous cart to authenticated user
 * Call this after login to merge sessionId cart with user cart
 */
export async function migrateCartOnLogin(userId: string): Promise<void> {
  const sessionId = getOrCreateSessionId();
  const localItems = getLocalCartItems();
  
  if (localItems.length === 0) {
    return; // Nothing to migrate
  }
  
  try {
    // Send local items to server to merge with user cart
    await fetch("/api/carts/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sessionId,
        items: localItems,
      }),
    });
    
    // Clear local cart after successful migration
    clearLocalCart();
  } catch (error) {
    console.error("Error migrating cart:", error);
    // Keep local cart as fallback
  }
}
