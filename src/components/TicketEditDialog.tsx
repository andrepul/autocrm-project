import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

type Ticket = Tables<"tickets">;
type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

interface TicketEditDialogProps {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export const TicketEditDialog = ({ ticket, open, onOpenChange, isAdmin }: TicketEditDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [status, setStatus] = useState<TicketStatus>(ticket.status as TicketStatus);
  const [assignedTo, setAssignedTo] = useState<string | null>(ticket.assigned_to);

  // Fetch workers for assignee selection (admin only)
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ["worker", "admin"]);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from("tickets")
      .update({
        title,
        description,
        status,
        assigned_to: assignedTo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ticket",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Ticket updated successfully",
    });
    
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    onOpenChange(false);
  };

  const handleAssigneeChange = (value: string) => {
    setAssignedTo(value === "unassigned" ? null : value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">Title</label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">Description</label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={(value: TicketStatus) => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <label htmlFor="assignee" className="text-sm font-medium">Assign To</label>
              <Select 
                value={assignedTo || "unassigned"} 
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.full_name || worker.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit">Save changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};