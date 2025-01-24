import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit, Trash2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type CustomField = Tables<"custom_fields">;

interface CustomFieldHeaderProps {
  field: CustomField;
  isAdmin: boolean;
  isEditing: boolean;
  editingName: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onEditingNameChange: (name: string) => void;
}

export const CustomFieldHeader = ({
  field,
  isAdmin,
  isEditing,
  editingName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditingNameChange,
}: CustomFieldHeaderProps) => {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <Input
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          className="flex-1"
        />
        <Button size="sm" onClick={onSaveEdit}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancelEdit}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <>
      <label className="text-sm font-medium flex-1">{field.name}</label>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onStartEdit}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Attention: This change will be reflected to all workers and customers</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Warning: this will remove the custom field. This action cannot be undone.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </>
  );
};