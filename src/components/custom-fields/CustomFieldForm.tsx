import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";

type CustomField = Tables<"custom_fields">;

interface CustomFieldFormProps {
  onSubmit: (name: string, type: "text" | "number" | "date" | "boolean") => void;
}

export const CustomFieldForm = ({ onSubmit }: CustomFieldFormProps) => {
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "date" | "boolean">("text");

  const handleSubmit = () => {
    if (!newFieldName.trim()) return;
    onSubmit(newFieldName, newFieldType);
    setNewFieldName("");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Create New Field</h3>
      <div className="flex gap-2">
        <Input
          placeholder="Field name"
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
        />
        <Select value={newFieldType} onValueChange={(value: any) => setNewFieldType(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="boolean">Boolean</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSubmit}>Create</Button>
      </div>
    </div>
  );
};