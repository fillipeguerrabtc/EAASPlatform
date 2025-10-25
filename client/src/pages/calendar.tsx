import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Calendar as CalendarIcon, Clock, MapPin, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCalendarEventSchema, type CalendarEvent } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const eventFormSchema = insertCalendarEventSchema.extend({
  startTime: z.string(),
  endTime: z.string(),
}).omit({ tenantId: true });

type EventFormData = z.infer<typeof eventFormSchema>;

export default function Calendar() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt-BR' ? ptBR : enUS;

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

  const upcomingEvents = events?.filter(event => 
    new Date(event.startTime) >= new Date()
  ).sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  ) || [];

  const pastEvents = events?.filter(event => 
    new Date(event.startTime) < new Date()
  ).sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  ) || [];

  const renderEventCard = (event: CalendarEvent, isPast: boolean = false) => (
    <Card 
      key={event.id} 
      className={`hover-elevate ${isPast ? 'opacity-60' : ''}`}
      data-testid={`card-event-${event.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {event.title}
            </CardTitle>
          </div>
          {!isPast && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteEventMutation.mutate(event.id)}
              disabled={deleteEventMutation.isPending}
              data-testid={`button-delete-event-${event.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.description && (
          <p className="text-sm text-muted-foreground">
            {event.description}
          </p>
        )}
        
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span data-testid={`text-event-time-${event.id}`}>
              {format(new Date(event.startTime), "PPp", { locale })}
            </span>
          </div>
          
          {event.startTime !== event.endTime && (
            <div className="flex items-center gap-2 pl-6 text-muted-foreground">
              <span>até</span>
              <span>{format(new Date(event.endTime), "PPp", { locale })}</span>
            </div>
          )}
        </div>

        {isPast && (
          <Badge variant="outline" className="w-fit">
            {t('calendar.past')}
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold" data-testid="text-calendar-title">
            {t('calendar.title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('calendar.subtitle')}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-event">
              <Plus className="mr-2 h-4 w-4" /> {t('calendar.addEvent')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('calendar.addEvent')}</DialogTitle>
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
                      <FormLabel>{t('calendar.customerId')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('calendar.customerIdPlaceholder')} data-testid="input-event-customer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
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

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming Events */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">{t('calendar.upcomingEvents')}</h2>
            {upcomingEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((event) => renderEventCard(event, false))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('calendar.noUpcomingEvents')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('calendar.noUpcomingEventsDesc')}
                </p>
                <Button onClick={() => setOpen(true)} data-testid="button-create-first-event">
                  <Plus className="mr-2 h-4 w-4" /> {t('calendar.addEvent')}
                </Button>
              </Card>
            )}
          </div>

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">{t('calendar.pastEvents')}</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pastEvents.slice(0, 6).map((event) => renderEventCard(event, true))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
