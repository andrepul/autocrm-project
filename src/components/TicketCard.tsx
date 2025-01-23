import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, MessageSquare } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { TicketEditDialog } from "./TicketEditDialog";
import { TicketResponseDialog } from "./TicketResponseDialog";

type Ticket = Tables<"tickets">;

interface TicketCardProps {
  ticket: Ticket;
}

export const TicketCard = ({ ticket }: TicketCardProps) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);

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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{ticket.title}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge className={getStatusBadgeColor(ticket.status)}>
                  {ticket.status}
                </Badge>
                <Badge className={getPriorityBadgeColor(ticket.priority)}>
                  {getPriorityLabel(ticket.priority)}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 line-clamp-2">{ticket.description}</p>
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowEditDialog(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TicketEditDialog 
        ticket={ticket}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      
      <TicketResponseDialog
        ticket={ticket}
        open={showResponseDialog}
        onOpenChange={setShowResponseDialog}
      />
    </>
  );
};