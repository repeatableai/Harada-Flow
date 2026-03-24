import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function NewDeliverableDialog({ open, onOpenChange, onSubmit }) {
  const [description, setDescription] = useState("");
  const [type, setType] = useState("productivity");

  const handleSubmit = () => {
    if (!description.trim()) return;
    onSubmit(description.trim(), type);
    setDescription("");
    setType("productivity");
  };

  const handleCancel = () => {
    setDescription("");
    setType("productivity");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Create Custom Deliverable</DialogTitle>
          <DialogDescription className="text-blue-200">
            Describe the deliverable you want to create requests for
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">
              Deliverable Description
            </Label>
            <Textarea
              id="description"
              placeholder="e.g., Quarterly business review presentation for stakeholders..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder-blue-300 min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Deliverable Type</Label>
            <RadioGroup value={type} onValueChange={setType} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="productivity"
                  id="productivity"
                  className="border-blue-400 text-blue-400"
                />
                <Label htmlFor="productivity" className="text-blue-200 cursor-pointer">
                  Productivity
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="performance"
                  id="performance"
                  className="border-purple-400 text-purple-400"
                />
                <Label htmlFor="performance" className="text-purple-200 cursor-pointer">
                  Performance
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!description.trim()}
            className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white disabled:opacity-50"
          >
            Create Requests
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
