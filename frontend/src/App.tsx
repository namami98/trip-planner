import { FormEvent, useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const INTERESTS = [
  'Food',
  'Culture',
  'Nature',
  'Nightlife',
  'Adventure',
  'Relaxation',
] as const

type ApiStatus = 'checking' | 'ok' | 'offline'

type Activity = {
  time_of_day: string
  name: string
  description: string
  estimated_cost_usd: number
}

type ItineraryDay = {
  day: number
  date: string
  title: string
  activities: Activity[]
}

type Itinerary = {
  destination: string
  summary: string
  total_estimated_cost_usd: number
  days: ItineraryDay[]
}

function App() {
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [interests, setInterests] = useState<string[]>(['Food', 'Culture'])
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    let cancelled = false

    fetch(`${API_URL}/health`)
      .then(async (response) => {
        const data = (await response.json()) as { status?: string }
        if (!cancelled) {
          setApiStatus(response.ok && data.status === 'ok' ? 'ok' : 'offline')
        }
      })
      .catch(() => {
        if (!cancelled) setApiStatus('offline')
      })

    return () => {
      cancelled = true
    }
  }, [])

  function toggleInterest(interest: string) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setItinerary(null)
    setIsGenerating(true)

    try {
      const response = await fetch(`${API_URL}/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim(),
          start_date: startDate,
          end_date: endDate,
          budget: Number(budget),
          interests,
        }),
      })

      const data = (await response.json().catch(() => null)) as
        | Itinerary
        | { detail?: string | Array<{ msg?: string }> }
        | null

      if (!response.ok) {
        throw new Error(readErrorDetail(data) || `Request failed (${response.status})`)
      }

      if (!data || !('days' in data) || !Array.isArray(data.days)) {
        throw new Error('The API returned an unexpected itinerary response.')
      }

      setItinerary(data)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not generate an itinerary. Please try again.'
      setErrorMessage(message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          Wander
        </div>
        <p className={`status status-${apiStatus}`}>
          {apiStatus === 'checking' && 'Checking API…'}
          {apiStatus === 'ok' && 'API connected'}
          {apiStatus === 'offline' && 'API offline — start the backend'}
        </p>
      </header>

      <main className="layout">
        <section className="intro">
          <p className="eyebrow">AI trip planner · step 1</p>
          <h1>Plan a trip that actually fits how you travel.</h1>
          <p className="lede">
            Tell us where you are going, when, and what you care about. We will
            generate a day-by-day itinerary in a later step.
          </p>
        </section>

        <form className="card" onSubmit={handleSubmit}>
          <label>
            Destination
            <input
              type="text"
              name="destination"
              placeholder="Kyoto, Lisbon, Banff…"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </label>

          <div className="row">
            <label>
              Start date
              <input
                type="date"
                name="startDate"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </label>
            <label>
              End date
              <input
                type="date"
                name="endDate"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Budget (USD)
            <input
              type="number"
              name="budget"
              min="1"
              step="50"
              placeholder="2500"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              required
            />
          </label>

          <fieldset>
            <legend>Interests</legend>
            <div className="chips">
              {INTERESTS.map((interest) => {
                const selected = interests.includes(interest)
                return (
                  <button
                    key={interest}
                    type="button"
                    className={selected ? 'chip selected' : 'chip'}
                    aria-pressed={selected}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <button type="submit" className="generate" disabled={isGenerating}>
            {isGenerating ? 'Generating…' : 'Generate Itinerary'}
          </button>

          {isGenerating ? (
            <p className="notice" role="status">
              Creating a day-by-day itinerary. This can take a few seconds.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </form>

        {itinerary ? (
          <section className="itinerary" aria-live="polite">
            <h2>{itinerary.destination}</h2>
            <p className="summary">{itinerary.summary}</p>
            <p className="cost">
              Estimated total: ${Math.round(itinerary.total_estimated_cost_usd)}
            </p>
            {itinerary.days.map((day) => (
              <article key={`${day.day}-${day.date}`} className="day">
                <h3>
                  Day {day.day}
                  {day.date ? ` · ${day.date}` : ''}
                  {day.title ? ` — ${day.title}` : ''}
                </h3>
                <ul>
                  {day.activities.map((activity, index) => (
                    <li key={`${day.day}-${activity.name}-${index}`}>
                      <strong>
                        {activity.time_of_day}: {activity.name}
                      </strong>
                      <p>{activity.description}</p>
                      <span>
                        About ${Math.round(activity.estimated_cost_usd)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  )
}

function readErrorDetail(
  data: Itinerary | { detail?: string | Array<{ msg?: string }> } | null,
): string {
  if (!data || typeof data !== 'object' || !('detail' in data) || data.detail == null) {
    return ''
  }

  if (typeof data.detail === 'string') {
    return data.detail
  }

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

export default App
