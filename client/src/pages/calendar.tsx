import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar as BigCalendar, momentLocalizer, View, SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar as CalendarIcon, Users, Trash2, UserPlus, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCalendarEventSchema, insertCalendarEventParticipantSchema, type CalendarEvent, type CalendarEventParticipant } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Configure moment for react-big-calendar
const localizer = momentLocalizer(moment);

const eventFormSchema = insertCalendarEventSchema.extend({
  startTime: z.string(),
  endTime: z.string(),
}).omit({ tenantId: true });

type EventFormData = z.infer<typeof eventFormSchema>;

type User = {
  id: string;
  name: string;
  email: string;
};

const participantFormSchema = z.object({
  participantType: z.enum(['internal', 'external']),
  userId: z.string().optional(),
  externalEmail: z.string().email().optional(),
  name: z.string().optional(),
}).refine((data) => {
  if (data.participantType === 'internal') {
    return !!data.userId;
  }
  return !!data.externalEmail && !!data.name;
}, {
  message: "Por favor preencha os campos obrigatórios",
});

type ParticipantFormData = z.infer<typeof participantFormSchema>;

export default function Calendar() {
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
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

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: participants = [], isLoading: participantsLoading } = useQuery<CalendarEventParticipant[]>({
    queryKey: ["/api/calendar-events", selectedEvent?.id, "participants"],
    enabled: !!selectedEvent,
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

  const participantForm = useForm<ParticipantFormData>({
    resolver: zodResolver(participantFormSchema),
    defaultValues: {
      participantType: 'internal',
      userId: '',
      externalEmail: '',
      name: '',
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
      setDetailsOpen(false);
      setSelectedEvent(null);
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

  const addParticipantMutation = useMutation({
    mutationFn: async (data: ParticipantFormData) => {
      if (!selectedEvent) return;
      
      const payload = {
        eventId: selectedEvent.id,
        userId: data.participantType === 'internal' ? data.userId : null,
        externalEmail: data.participantType === 'external' ? data.externalEmail : null,
        name: data.participantType === 'external' ? data.name : null,
        status: 'pending',
      };
      
      return apiRequest("POST", `/api/calendar-events/${selectedEvent.id}/participants`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events", selectedEvent?.id, "participants"] });
      participantForm.reset();
      toast({
        title: "Participante adicionado",
        description: "O participante foi adicionado ao evento com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar participante",
        description: error.message || "Não foi possível adicionar o participante.",
        variant: "destructive",
      });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      if (!selectedEvent) return;
      return apiRequest("DELETE", `/api/calendar-events/${selectedEvent.id}/participants/${participantId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events", selectedEvent?.id, "participants"] });
      toast({
        title: "Participante removido",
        description: "O participante foi removido do evento.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover participante",
        description: error.message || "Não foi possível remover o participante.",
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

  // Handle event click - open details dialog
  const handleSelectEvent = useCallback((event: any) => {
    const eventData = event.resource as CalendarEvent;
    setSelectedEvent(eventData);
    setDetailsOpen(true);
  }, []);

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    if (window.confirm(t('calendar.deleteConfirm', { title: selectedEvent.title }))) {
      deleteEventMutation.mutate(selectedEvent.id);
    }
  };

  const onSubmitParticipant = (data: ParticipantFormData) => {
    addParticipantMutation.mutate(data);
  };

  const handleRemoveParticipant = (participantId: string) => {
    if (window.confirm('Remover este participante do evento?')) {
      removeParticipantMutation.mutate(participantId);
    }
  };

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

          {/* Event Details Dialog with Participants */}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-event-details">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  {selectedEvent?.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedEvent && moment(selectedEvent.startTime).format('LLLL')}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details" data-testid="tab-event-details">Detalhes</TabsTrigger>
                  <TabsTrigger value="participants" data-testid="tab-event-participants">
                    <Users className="h-4 w-4 mr-2" />
                    Participantes ({participants.length})
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4">
                  {selectedEvent && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-sm text-muted-foreground">Descrição</h3>
                        <p className="mt-1">{selectedEvent.description || 'Sem descrição'}</p>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold text-sm text-muted-foreground">Início</h3>
                          <p className="mt-1">{moment(selectedEvent.startTime).format('DD/MM/YYYY HH:mm')}</p>
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-muted-foreground">Fim</h3>
                          <p className="mt-1">{moment(selectedEvent.endTime).format('DD/MM/YYYY HH:mm')}</p>
                        </div>
                      </div>

                      {selectedEvent.customerId && (
                        <>
                          <Separator />
                          <div>
                            <h3 className="font-semibold text-sm text-muted-foreground">Cliente ID</h3>
                            <p className="mt-1">{selectedEvent.customerId}</p>
                          </div>
                        </>
                      )}

                      <Separator />

                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteEvent}
                        disabled={deleteEventMutation.isPending}
                        data-testid="button-delete-event"
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleteEventMutation.isPending ? 'Deletando...' : 'Deletar Evento'}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* Participants Tab */}
                <TabsContent value="participants" className="space-y-4">
                  {/* Add Participant Form */}
                  <Card className="p-4 bg-muted/50">
                    <h3 className="font-semibold flex items-center gap-2 mb-4">
                      <UserPlus className="h-4 w-4" />
                      Adicionar Participante
                    </h3>
                    <Form {...participantForm}>
                      <form onSubmit={participantForm.handleSubmit(onSubmitParticipant)} className="space-y-4">
                        <FormField
                          control={participantForm.control}
                          name="participantType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Participante</FormLabel>
                              <FormControl>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <SelectTrigger data-testid="select-participant-type">
                                    <SelectValue placeholder="Selecione o tipo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="internal">Usuário Interno</SelectItem>
                                    <SelectItem value="external">Participante Externo</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {participantForm.watch('participantType') === 'internal' && (
                          <FormField
                            control={participantForm.control}
                            name="userId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Usuário</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger data-testid="select-internal-user">
                                      <SelectValue placeholder="Selecione um usuário" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {users?.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                          {user.name} ({user.email})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {participantForm.watch('participantType') === 'external' && (
                          <>
                            <FormField
                              control={participantForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nome</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Nome do participante" data-testid="input-external-name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={participantForm.control}
                              name="externalEmail"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="email@exemplo.com" data-testid="input-external-email" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        )}

                        <Button 
                          type="submit" 
                          disabled={addParticipantMutation.isPending}
                          className="w-full"
                          data-testid="button-add-participant"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          {addParticipantMutation.isPending ? 'Adicionando...' : 'Adicionar Participante'}
                        </Button>
                      </form>
                    </Form>
                  </Card>

                  <Separator />

                  {/* Participants List */}
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Participantes Cadastrados
                    </h3>
                    
                    {participantsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Carregando participantes...
                      </div>
                    ) : participants.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum participante adicionado ainda
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {participants.map((participant) => {
                          const user = users?.find(u => u.id === participant.userId);
                          const displayName = participant.userId 
                            ? user?.name || 'Usuário desconhecido'
                            : participant.name;
                          const displayEmail = participant.userId
                            ? user?.email
                            : participant.externalEmail;

                          const statusColors = {
                            pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
                            accepted: 'bg-green-500/10 text-green-700 dark:text-green-400',
                            declined: 'bg-red-500/10 text-red-700 dark:text-red-400',
                          };

                          return (
                            <Card key={participant.id} className="p-4 flex items-center justify-between gap-4" data-testid={`participant-${participant.id}`}>
                              <div className="flex items-center gap-3 flex-1">
                                {participant.userId ? (
                                  <Users className="h-4 w-4 text-primary" />
                                ) : (
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">{displayName}</p>
                                  <p className="text-sm text-muted-foreground">{displayEmail}</p>
                                </div>
                                <Badge className={statusColors[participant.status as keyof typeof statusColors]}>
                                  {participant.status === 'pending' && 'Pendente'}
                                  {participant.status === 'accepted' && 'Aceito'}
                                  {participant.status === 'declined' && 'Recusado'}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveParticipant(participant.id)}
                                disabled={removeParticipantMutation.isPending}
                                data-testid={`button-remove-participant-${participant.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
