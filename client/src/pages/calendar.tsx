import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar as BigCalendar, momentLocalizer, View, SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCalendarEventSchema, type CalendarEvent } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { SEO } from "@/components/seo";

// Configure moment for react-big-calendar
const localizer = momentLocalizer(moment);

const eventFormSchema = insertCalendarEventSchema.extend({
  startTime: z.string(),
  endTime: z.string(),
}).omit({ tenantId: true });

type EventFormData = z.infer<typeof eventFormSchema>;

export default function Calendar() {
  const [open, setOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Set moment locale
  moment.locale(i18n.language === 'pt-BR' ? 'pt-br' : 'en');

  const { data: events, isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events"],
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startTime: "",
      endTime: "",
      customerId: "",
      resourceId: "",
      orderId: "",
      metadata: {},
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const payload = {
        ...data,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
      };
      return apiRequest("POST", "/api/calendar-events", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      setOpen(false);
      setSelectedSlot(null);
      form.reset();
      toast({
        title: t('common.success'),
        description: t('calendar.createSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('calendar.createError'),
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/calendar-events/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({
        title: t('common.success'),
        description: t('calendar.deleteSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('calendar.deleteError'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EventFormData) => {
    createEventMutation.mutate(data);
  };

  // Transform events for react-big-calendar
  const calendarEvents = useMemo(() => {
    return (events || []).map(event => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      resource: event,
    }));
  }, [events]);

  // Handle slot selection (clicking on empty time slot)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setSelectedSlot({
      start: slotInfo.start as Date,
      end: slotInfo.end as Date,
    });
    
    // Pre-fill form with selected times
    const startStr = moment(slotInfo.start).format('YYYY-MM-DDTHH:mm');
    const endStr = moment(slotInfo.end).format('YYYY-MM-DDTHH:mm');
    
    form.setValue('startTime', startStr);
    form.setValue('endTime', endStr);
    
    setOpen(true);
  }, [form]);

  // Handle event click
  const handleSelectEvent = useCallback((event: any) => {
    const eventData = event.resource as CalendarEvent;
    
    if (window.confirm(t('calendar.deleteConfirm', { title: eventData.title }))) {
      deleteEventMutation.mutate(eventData.id);
    }
  }, [t, deleteEventMutation]);

  // Handle new event button click
  const handleNewEvent = () => {
    setSelectedSlot(null);
    form.reset({
      title: "",
      description: "",
      startTime: moment().format('YYYY-MM-DDTHH:mm'),
      endTime: moment().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
      customerId: "",
      resourceId: "",
      orderId: "",
      metadata: {},
    });
    setOpen(true);
  };

  // Custom event style
  const eventStyleGetter = () => {
    return {
      style: {
        backgroundColor: 'hsl(var(--primary))',
        borderRadius: '4px',
        opacity: 0.95,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  return (
    <>
      <SEO
        title="Calendário Inteligente - EAAS Platform"
        description="Gerencie eventos, agendamentos e compromissos empresariais com calendário visual inteligente. Sistema completo de gestão empresarial EAAS."
        keywords="calendário, eventos, agendamentos, compromissos, gestão de tempo, EAAS"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="container mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent" data-testid="text-calendar-title">
                {t('calendar.title')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('calendar.subtitle')}
              </p>
            </div>
            <Button
              onClick={handleNewEvent}
              className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              data-testid="button-add-event"
            >
              <Plus className="mr-2 h-4 w-4" /> {t('calendar.addEvent')}
            </Button>
          </div>

          {/* Calendar */}
          <Card className="p-6 border-primary/20">
            {isLoading ? (
              <div className="h-[600px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
                  <p className="text-muted-foreground">Carregando calendário...</p>
                </div>
              </div>
            ) : (
              <BigCalendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                selectable
                popup
                eventPropGetter={eventStyleGetter}
                messages={{
                  next: t('calendar.next'),
                  previous: t('calendar.previous'),
                  today: t('calendar.today'),
                  month: t('calendar.month'),
                  week: t('calendar.week'),
                  day: t('calendar.day'),
                  agenda: t('calendar.agenda'),
                  date: t('calendar.date'),
                  time: t('calendar.time'),
                  event: t('calendar.event'),
                  noEventsInRange: t('calendar.noEventsInRange'),
                  showMore: (total: number) => `+ ${total} ${t('calendar.showMore')}`,
                }}
                data-testid="calendar-view"
              />
            )}
          </Card>

          {/* Event Dialog */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl" data-testid="dialog-event-form">
              <DialogHeader>
                <DialogTitle>
                  {selectedSlot ? t('calendar.addEvent') : t('calendar.addEvent')}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('calendar.eventTitle')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('calendar.titlePlaceholder')} data-testid="input-event-title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.description')}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t('calendar.descriptionPlaceholder')} data-testid="input-event-description" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('calendar.startTime')}</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" data-testid="input-event-start" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('calendar.endTime')}</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" data-testid="input-event-end" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('calendar.customerId')} (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder={t('calendar.customerIdPlaceholder')} data-testid="input-event-customer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-wrap justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-event">
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-submit-event">
                      {createEventMutation.isPending ? t('common.creating') : t('calendar.addEvent')}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
