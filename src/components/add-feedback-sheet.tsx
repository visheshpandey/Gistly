"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useFeedbackData } from "@/components/data-provider";
import { normalizeText } from "@/lib/local/normalize";

const MIN_LENGTH = 3;
const MAX_LENGTH = 2000;

export function AddFeedbackSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addFeedback, summary } = useFeedbackData();
  const [review, setReview] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null);
      setAdded(false);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = review.trim();
    if (text.length < MIN_LENGTH) {
      setError(`Please write at least ${MIN_LENGTH} characters.`);
      setAdded(false);
      return;
    }
    if (normalizeText(text) === "") {
      setError("Please include some words, not only symbols or links.");
      setAdded(false);
      return;
    }
    addFeedback(text, category);
    setReview("");
    setError(null);
    setAdded(true);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add feedback</SheetTitle>
          <SheetDescription>
            Add one piece of customer feedback. It joins the current dataset.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-review" className="text-sm font-medium">
              Feedback
            </label>
            <textarea
              id="new-review"
              value={review}
              onChange={(e) => {
                setReview(e.target.value);
                setAdded(false);
              }}
              rows={5}
              maxLength={MAX_LENGTH}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "new-review-error" : undefined}
              placeholder="What did the customer say?"
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
            />
            {error && (
              <p id="new-review-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-category" className="text-sm font-medium">
              Category <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="new-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="category-options"
              maxLength={80}
              placeholder="e.g. Customer Service"
            />
            <datalist id="category-options">
              {summary.categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <Button type="submit">Add feedback</Button>
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {added ? "Added. Search for it in the table to find it." : ""}
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
