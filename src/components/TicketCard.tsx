import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, MessageSquare, StickyNote, Tag, Settings, Clock, RefreshCw, Star } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { TicketEditDialog } from "./TicketEditDialog";
import { TicketResponseDialog } from "./TicketResponseDialog";
import { TicketInternalNotesDialog } from "./TicketInternalNotesDialog";
import { TicketCustomFieldsDialog } from "./TicketCustomFieldsDialog";
import { TicketTagsDialog } from "./TicketTagsDialog";
import { TicketFeedbackDialog } from "./TicketFeedbackDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from 'date-fns';

type Ticket = Tables<"tickets"> & {
  ticket_tags?: {
    tags: Tables<"tags">;
  }[];
  ticket_feedback?: Tables<"ticket_feedback">[];
};

interface TicketCardProps {
  ticket: Ticket;
}

export const TicketCard = ({ ticket }: TicketCardProps) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [showInternalNotesDialog, setShowInternalNotesDialog] = useState(false);
  const [showCustomFieldsDialog, setShowCustomFieldsDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  // Fetch user profile to determine role
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const isWorkerOrAdmin = profile?.role === "worker" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";
  const isCustomer = profile?.role === "customer";
  const needsFeedback = isCustomer && 
    (ticket.status === "resolved" || ticket.status === "closed") && 
    (!ticket.ticket_feedback || ticket.ticket_feedback.length === 0) &&
    ticket.customer_id === profile.id;

  const hasFeedback = ticket.ticket_feedback && ticket.ticket_feedback.length > 0;
  const feedback = hasFeedback ? ticket.ticket_feedback[0] : null;

  const getStatusBadgeColor = (status: string | null) => {
    switch (status) {
      case "open":
        return "bg-blue-500";
      case "in_progress":
        return "bg-yellow-500";
      case "resolved":
        return "bg-green-500";
      case "closed":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPriorityBadgeColor = (priority: number | null) => {
    switch (priority) {
      case 3:
        return "bg-red-500";
      case 2:
        return "bg-orange-500";
      case 1:
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPriorityLabel = (priority: number | null) => {
    switch (priority) {
      case 3:
        return "High";
      case 2:
        return "Medium";
      case 1:
        return "Low";
      default:
        return "Unknown";
    }
  };

  const renderStars = (rating: string) => {
    const numRating = parseInt(rating);
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= numRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{ticket.title}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge className={`rounded-none ${getStatusBadgeColor(ticket.status)}`}>
                  {ticket.status}
                </Badge>
                <Badge 
                  className={`rounded-full ${getPriorityBadgeColor(ticket.priority)}`}
                  variant="outline"
                >
                  {getPriorityLabel(ticket.priority)}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {needsFeedback && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800 mb-2">
                This ticket has been marked as {ticket.status}. How was your experience?
              </p>
              <Button
                size="sm"
                onClick={() => setShowFeedbackDialog(true)}
                className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              >
                <Star className="w-4 h-4 mr-2" />
                Rate Your Experience
              </Button>
            </div>
          )}

          {hasFeedback && feedback && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800 font-medium mb-1">
                Thank you for your feedback!
              </p>
              {renderStars(feedback.rating)}
              {feedback.feedback_text && (
                <p className="text-sm text-blue-700 mt-2 line-clamp-2">
                  {feedback.feedback_text}
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-gray-500 line-clamp-2">{ticket.description}</p>
          
          <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Created {formatDistanceToNow(new Date(ticket.created_at))} ago
            </div>
            {ticket.updated_at !== ticket.created_at && (
              <div className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Updated {formatDistanceToNow(new Date(ticket.updated_at))} ago
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-gray-400">
              {new Date(ticket.created_at).toLocaleDateString()}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowResponseDialog(true)}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              {isWorkerOrAdmin && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowInternalNotesDialog(true)}
                  >
                    <StickyNote className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowCustomFieldsDialog(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          {isWorkerOrAdmin && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-2 items-center">
                {ticket.ticket_tags?.map(({ tags }) => (
                  <Badge
                    key={tags.id}
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                  >
                    {tags.name}
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs ml-auto"
                  onClick={() => setShowTagsDialog(true)}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  Manage Tags
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TicketEditDialog 
        ticket={ticket}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        isAdmin={isAdmin}
      />
      
      <TicketResponseDialog
        ticket={ticket}
        open={showResponseDialog}
        onOpenChange={setShowResponseDialog}
      />

      {isWorkerOrAdmin && (
        <>
          <TicketInternalNotesDialog
            ticket={ticket}
            open={showInternalNotesDialog}
            onOpenChange={setShowInternalNotesDialog}
          />
          
          <TicketCustomFieldsDialog
            ticket={ticket}
            open={showCustomFieldsDialog}
            onOpenChange={setShowCustomFieldsDialog}
            isAdmin={isAdmin}
          />
          
          <TicketTagsDialog
            ticket={ticket}
            open={showTagsDialog}
            onOpenChange={setShowTagsDialog}
            isAdmin={isAdmin}
          />
        </>
      )}

      {needsFeedback && (
        <TicketFeedbackDialog
          ticketId={ticket.id}
          ticketTitle={ticket.title}
          open={showFeedbackDialog}
          onOpenChange={setShowFeedbackDialog}
        />
      )}
    </>
  );
};
