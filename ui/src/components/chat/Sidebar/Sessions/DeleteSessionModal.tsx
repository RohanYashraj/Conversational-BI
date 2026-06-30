import { type FC } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface DeleteSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => Promise<void>
  isDeleting: boolean
}

const DeleteSessionModal: FC<DeleteSessionModalProps> = ({
  isOpen,
  onClose,
  onDelete,
  isDeleting
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="border-border bg-card font-sans">
      <DialogHeader>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogDescription>
          This will permanently delete the session. You cannot undo this action.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="outline"
          type="button"
          className="rounded-xl border-border"
          onClick={onClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-xl"
        >
          Delete Session
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export default DeleteSessionModal
