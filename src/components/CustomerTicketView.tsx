import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketCard } from "./TicketCard";

export const CustomerTicketView = () => {
  // Fetch user's tickets
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["customerTickets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      console.log("Fetching tickets for user:", user.id);

      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          ticket_tags (
            tags (
              id,
              name,
              created_at,
              updated_at
            )
          ),
          ticket_feedback (
            id,
            rating,
            feedback_text,
            created_at,
            updated_at,
            ticket_id
          )
        `)
        .eq("customer_id", user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching tickets:", error);
        throw error;
      }
      
      console.log("Fetched tickets:", data);
      
      // Transform the data to ensure ticket_feedback is always an array
      return data.map(ticket => ({
        ...ticket,
        // If ticket_feedback is null/undefined, use empty array
        // If it's an array, use it as is
        // If it's an object (single feedback), wrap it in an array
        ticket_feedback: Array.isArray(ticket.ticket_feedback) 
          ? ticket.ticket_feedback 
          : ticket.ticket_feedback 
            ? [ticket.ticket_feedback] 
            : []
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-medium text-gray-900">No tickets yet</h3>
        <p className="text-gray-500">Create a new ticket to get started</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
};