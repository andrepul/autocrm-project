import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Ticket = Tables<"tickets">;
type InternalNote = Tables<"ticket_internal_notes">;

interface InternalNoteWithProfile extends InternalNote {
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface TicketInternalNotesDialogProps {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TicketInternalNotesDialog = ({
  ticket,
  open,
  onOpenChange,
}: TicketInternalNotesDialogProps) => {
  const [notes, setNotes] = useState<InternalNoteWithProfile[]>([]);
  const [newNote, setNewNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      loadNotes();
    }
  }, [open, ticket.id]);

  const loadNotes = async () => {
    const { data, error } = await supabase
      .from("ticket_internal_notes")
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
      console.error("Error loading notes:", error);
      return;
    }

    setNotes(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("ticket_internal_notes")
      .insert({
        ticket_id: ticket.id,
        author_id: user.id,
        content: newNote,
      });

    if (error) {
      console.error("Error adding note:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add note",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Note added successfully",
    });

    setNewNote("");
    loadNotes();
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Internal Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {notes.map((note) => (
              <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium">
                    {note.profiles?.full_name || note.profiles?.email || 'Unknown User'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{note.content}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="note" className="text-sm font-medium">Add Note</label>
              <Textarea
                id="note"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                required
                placeholder="Type your note here..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="submit">Add Note</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};