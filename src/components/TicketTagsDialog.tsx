import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "./ui/badge";
import { X } from "lucide-react";

type Ticket = Tables<"tickets">;
type Tag = Tables<"tags">;

interface TicketTagsDialogProps {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

export const TicketTagsDialog = ({
  ticket,
  open,
  onOpenChange,
  isAdmin,
}: TicketTagsDialogProps) => {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [ticketTags, setTicketTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open]);

  const loadTags = async () => {
    // Load all available tags
    const { data: allTags, error: tagsError } = await supabase
      .from("tags")
      .select("*")
      .order("name");

    if (tagsError) {
      console.error("Error loading tags:", tagsError);
      return;
    }

    // Load ticket's tags
    const { data: ticketTagsData, error: ticketTagsError } = await supabase
      .from("ticket_tags")
      .select("tag_id, tags(*)")
      .eq("ticket_id", ticket.id);

    if (ticketTagsError) {
      console.error("Error loading ticket tags:", ticketTagsError);
      return;
    }

    setAvailableTags(allTags || []);
    setTicketTags(ticketTagsData?.map(tt => tt.tags) || []);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    const { data, error } = await supabase
      .from("tags")
      .insert({ name: newTagName.trim() })
      .select()
      .single();

    if (error) {
      console.error("Error creating tag:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create tag",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Tag created successfully",
    });

    setNewTagName("");
    loadTags();
  };

  const handleAddTag = async (tag: Tag) => {
    const { error } = await supabase
      .from("ticket_tags")
      .insert({
        ticket_id: ticket.id,
        tag_id: tag.id,
      });

    if (error) {
      console.error("Error adding tag to ticket:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add tag to ticket",
      });
      return;
    }

    loadTags();
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  const handleRemoveTag = async (tag: Tag) => {
    const { error } = await supabase
      .from("ticket_tags")
      .delete()
      .eq("ticket_id", ticket.id)
      .eq("tag_id", tag.id);

    if (error) {
      console.error("Error removing tag from ticket:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove tag from ticket",
      });
      return;
    }

    loadTags();
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex gap-2">
              <Input
                placeholder="New tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
              <Button onClick={handleCreateTag}>Create</Button>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Tags</label>
            <div className="flex flex-wrap gap-2">
              {ticketTags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
                  {tag.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  />
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Available Tags</label>
            <div className="flex flex-wrap gap-2">
              {availableTags
                .filter(tag => !ticketTags.some(tt => tt.id === tag.id))
                .map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-secondary"
                    onClick={() => handleAddTag(tag)}
                  >
                    {tag.name}
                  </Badge>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};