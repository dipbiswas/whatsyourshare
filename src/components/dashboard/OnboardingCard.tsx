"use client"

import Link from "next/link"
import { Users, Receipt, DollarSign, ArrowRight, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const STEPS = [
  {
    icon: Users,
    title: "Create your first group",
    desc: "Roommates, a trip, a dinner — any collection of people who share costs.",
    href: "/groups",
    cta: "Create group",
  },
  {
    icon: Receipt,
    title: "Add an expense",
    desc: "Enter what you paid. We split it fairly and track who owes what.",
    href: "/groups",
    cta: "Add expense",
  },
  {
    icon: DollarSign,
    title: "Settle up",
    desc: "When it's time to pay back, use cash or Stripe instant transfer.",
    href: "/settings",
    cta: "Connect Stripe",
  },
]

interface Props {
  userName: string
}

export function OnboardingCard({ userName }: Props) {
  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-white overflow-hidden">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Welcome, {userName}! 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Get started in 3 steps. You&apos;ll be splitting expenses in under 2 minutes.
          </p>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="flex items-center gap-4 bg-white rounded-xl p-4 border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 shrink-0">
                <step.icon className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-indigo-400">Step {i + 1}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
              </div>
              <Link href={step.href}>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-colors text-xs"
                >
                  {step.cta}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <Check className="h-3.5 w-3.5 text-indigo-400" />
          Account created — you&apos;re ready to go
        </div>
      </CardContent>
    </Card>
  )
}
