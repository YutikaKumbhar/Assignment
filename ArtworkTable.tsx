import { useState, useEffect, useRef } from 'react';
import { DataTable, DataTableSelectAllChangeEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Paginator, PaginatorPageChangeEvent } from 'primereact/paginator';
import type { Artwork, ApiResponse } from '@/types/artwork';

const API_BASE_URL = 'https://api.artic.edu/api/v1/artworks';
const ROWS_PER_PAGE = 12;

type SelectionMode = 'manual' | 'custom';

export const ArtworkTable = () => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Selection state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('manual');
  const [customSelectTarget, setCustomSelectTarget] = useState<number>(0);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [deselectedRowIds, setDeselectedRowIds] = useState<Set<number>>(new Set());
  const [customSelectCount, setCustomSelectCount] = useState('');
  
  const overlayPanelRef = useRef<OverlayPanel>(null);

  useEffect(() => {
    fetchArtworks(currentPage);
  }, [currentPage]);

  const fetchArtworks = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}?page=${page}&limit=${ROWS_PER_PAGE}`);
      const data: ApiResponse = await response.json();
      setArtworks(data.data);
      setTotalRecords(data.pagination.total);
    } catch (error) {
      console.error('Error fetching artworks:', error);
    } finally {
      setLoading(false);
    }
  };

  const onPageChange = (event: PaginatorPageChangeEvent) => {
    setCurrentPage(event.page + 1);
  };

  // Determine if a specific artwork should be selected
  const isArtworkSelected = (artwork: Artwork, indexOnPage: number): boolean => {
    // Explicit deselection takes precedence
    if (deselectedRowIds.has(artwork.id)) return false;
    
    // Explicit selection
    if (selectedRowIds.has(artwork.id)) return true;
    
    // Custom selection mode: select based on position
    if (selectionMode === 'custom' && customSelectTarget > 0) {
      const globalPosition = (currentPage - 1) * ROWS_PER_PAGE + indexOnPage + 1;
      return globalPosition <= customSelectTarget;
    }
    
    return false;
  };

  // Calculate which rows are selected on current page
  const getSelectedArtworks = (): Artwork[] => {
    return artworks.filter((artwork, index) => isArtworkSelected(artwork, index));
  };

  // Calculate total selected rows across all pages
  const getTotalSelectedCount = (): number => {
    if (selectionMode === 'custom' && customSelectTarget > 0) {
      // In custom mode, account for deselections
      const deselectedInRange = Array.from(deselectedRowIds).filter(id => {
        // We need to check if this deselected ID would have been in the custom selection range
        // This is an approximation since we don't have all IDs, but we count deselections
        return true;
      }).length;
      return Math.max(0, Math.min(customSelectTarget, totalRecords) - deselectedInRange);
    } else {
      // In manual mode, count explicit selections minus deselections
      return selectedRowIds.size;
    }
  };

  // Check if all rows on current page are selected
  const isAllSelected = artworks.length > 0 && artworks.every((artwork, index) => 
    isArtworkSelected(artwork, index)
  );

  const onSelectionChange = (e: any) => {
    const newSelection = e.value as Artwork[];
    const newSelectedIds = new Set(selectedRowIds);
    const newDeselectedIds = new Set(deselectedRowIds);

    // When user manually changes selection, switch to manual mode
    setSelectionMode('manual');
    setCustomSelectTarget(0);

    // Update selection state for current page
    artworks.forEach((artwork, index) => {
      const isNowSelected = newSelection.some(item => item.id === artwork.id);
      const wasSelected = isArtworkSelected(artwork, index);
      
      if (isNowSelected && !wasSelected) {
        // Newly selected
        newSelectedIds.add(artwork.id);
        newDeselectedIds.delete(artwork.id);
      } else if (!isNowSelected && wasSelected) {
        // Newly deselected
        newDeselectedIds.add(artwork.id);
        newSelectedIds.delete(artwork.id);
      }
    });

    setSelectedRowIds(newSelectedIds);
    setDeselectedRowIds(newDeselectedIds);
  };

  const onSelectAllChange = (e: DataTableSelectAllChangeEvent) => {
    const newSelectedIds = new Set(selectedRowIds);
    const newDeselectedIds = new Set(deselectedRowIds);

    // Switch to manual mode
    setSelectionMode('manual');
    setCustomSelectTarget(0);

    if (e.checked) {
      // Select all on current page
      artworks.forEach(artwork => {
        newSelectedIds.add(artwork.id);
        newDeselectedIds.delete(artwork.id);
      });
    } else {
      // Deselect all on current page
      artworks.forEach(artwork => {
        newDeselectedIds.add(artwork.id);
        newSelectedIds.delete(artwork.id);
      });
    }

    setSelectedRowIds(newSelectedIds);
    setDeselectedRowIds(newDeselectedIds);
  };

  const handleCustomSelection = () => {
    const count = parseInt(customSelectCount);
    
    if (!count || count <= 0 || isNaN(count)) {
      alert('Please enter a valid positive number');
      return;
    }

    if (count > totalRecords) {
      alert(`Cannot select ${count} rows. Total available: ${totalRecords}`);
      return;
    }

    // Switch to custom selection mode
    setSelectionMode('custom');
    setCustomSelectTarget(count);
    
    // Clear manual selections
    setSelectedRowIds(new Set());
    setDeselectedRowIds(new Set());
    
    overlayPanelRef.current?.hide();
    setCustomSelectCount('');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Artwork Gallery</h1>
            <p className="mt-1 text-muted-foreground">
              Browse artworks from the Art Institute of Chicago
            </p>
            {getTotalSelectedCount() > 0 && (
              <p className="mt-2 text-sm font-medium text-primary">
                Selected: {getTotalSelectedCount()} rows
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {selectionMode === 'custom' && customSelectTarget > 0 && (
              <span className="text-sm text-muted-foreground">
                Selecting first {customSelectTarget} rows
              </span>
            )}
            <Button
              label="Select Rows"
              icon="pi pi-check-square"
              onClick={(e) => overlayPanelRef.current?.toggle(e)}
              severity="info"
            />
          </div>
        </div>

        <div className="rounded-lg bg-card shadow-sm">
          <DataTable
            value={artworks}
            loading={loading}
            selection={getSelectedArtworks()}
            onSelectionChange={onSelectionChange}
            onSelectAllChange={onSelectAllChange}
            selectAll={isAllSelected}
            dataKey="id"
            selectionMode="multiple"
            stripedRows
            className="artwork-table"
            emptyMessage="No artworks found"
          >
            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
            <Column 
              field="title" 
              header="TITLE" 
              style={{ minWidth: '250px' }}
              body={(rowData: Artwork) => (
                <span className="font-medium">{rowData.title || 'N/A'}</span>
              )}
            />
            <Column 
              field="place_of_origin" 
              header="PLACE OF ORIGIN" 
              style={{ minWidth: '150px' }}
              body={(rowData: Artwork) => rowData.place_of_origin || 'N/A'}
            />
            <Column 
              field="artist_display" 
              header="ARTIST" 
              style={{ minWidth: '200px' }}
              body={(rowData: Artwork) => rowData.artist_display || 'N/A'}
            />
            <Column 
              field="inscriptions" 
              header="INSCRIPTIONS" 
              style={{ minWidth: '200px' }}
              body={(rowData: Artwork) => rowData.inscriptions || 'N/A'}
            />
            <Column 
              field="date_start" 
              header="START DATE" 
              style={{ minWidth: '120px' }}
              body={(rowData: Artwork) => rowData.date_start ?? 'N/A'}
            />
            <Column 
              field="date_end" 
              header="END DATE" 
              style={{ minWidth: '120px' }}
              body={(rowData: Artwork) => rowData.date_end ?? 'N/A'}
            />
          </DataTable>

          <div className="border-t border-border bg-muted/30 p-4">
            <div className="mb-3 text-sm text-muted-foreground">
              Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1} to {Math.min(currentPage * ROWS_PER_PAGE, totalRecords)} of {totalRecords} entries
            </div>
            <Paginator
              first={(currentPage - 1) * ROWS_PER_PAGE}
              rows={ROWS_PER_PAGE}
              totalRecords={totalRecords}
              onPageChange={onPageChange}
              template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
            />
          </div>
        </div>

        <OverlayPanel ref={overlayPanelRef} className="w-80">
          <div className="space-y-4 p-2">
            <h3 className="text-lg font-semibold text-foreground">Custom Row Selection</h3>
            <p className="text-sm text-muted-foreground">
              Enter the number of rows you want to select from the beginning
            </p>
            <div className="flex gap-2">
              <InputText
                value={customSelectCount}
                onChange={(e) => setCustomSelectCount(e.target.value)}
                placeholder="Enter number"
                type="number"
                min="1"
                className="flex-1"
              />
              <Button
                label="Submit"
                onClick={handleCustomSelection}
                severity="info"
              />
            </div>
          </div>
        </OverlayPanel>
      </div>
    </div>
  );
};
