import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Ticket = Tables<"tickets">;
type TicketResponse = Tables<"ticket_responses">;

interface ResponseWithProfile extends TicketResponse {
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface TicketResponseDialogProps {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TicketResponseDialog = ({ ticket, open, onOpenChange }: TicketResponseDialogProps) => {
  const [responses, setResponses] = useState<ResponseWithProfile[]>([]);
  const [newResponse, setNewResponse] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      loadResponses();
    }
  }, [open, ticket.id]);

  const loadResponses = async () => {
    const { data, error } = await supabase
      .from("ticket_responses")
      .select(`
        *,
        profiles (
          full_name,
          email
        )
      `)
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading responses:", error);
      return;
    }

    setResponses(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("ticket_responses")
      .insert({
        ticket_id: ticket.id,
        responder_id: user.id,
        content: newResponse,
      });

    if (error) {
      console.error("Error adding response:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add response",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Response added successfully",
    });

    setNewResponse("");
    loadResponses();
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Ticket Responses</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {responses.map((response) => (
              <div key={response.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium">
                    {response.profiles?.full_name || response.profiles?.email || 'Unknown User'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(response.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{response.content}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="response" className="text-sm font-medium">Add Response</label>
              <Textarea
                id="response"
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                required
                placeholder="Type your response here..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="submit">Send Response</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};