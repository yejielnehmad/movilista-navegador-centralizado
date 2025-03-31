
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];

// Fetch all clients
export const fetchClients = async (): Promise<Client[]> => {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching clients:", error);
      toast.error("Error loading clients");
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error in fetchClients:", error);
    toast.error("Failed to load clients");
    return [];
  }
};

// Find a client by name (fuzzy match)
export const findClientByName = (clients: Client[], name: string): Client | null => {
  if (!name || !clients.length) return null;
  
  // Normalize the search name
  const searchName = name.toLowerCase().trim();
  
  // Try exact match first
  const exactMatch = clients.find(
    client => client.name.toLowerCase() === searchName
  );
  if (exactMatch) return exactMatch;
  
  // Try contains match
  const containsMatch = clients.find(
    client => client.name.toLowerCase().includes(searchName) || 
              searchName.includes(client.name.toLowerCase())
  );
  
  return containsMatch || null;
};
